var express = require('express');
var bodyParser = require('body-parser');
var sign = require('./sign.js');
var axios = require('axios');
var redis = require('redis');
var app = express();

// redis配置参数
var redis_config = {
  "host": "127.0.0.1",
  "port": 6379
};
var redisClient = redis.createClient(redis_config);

var appId = 'wx53921463966687ec'
var appsecret = '8ea2a0ab12318fa73e71517f07f189b7'
var openId = ''


app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))

// 设置允许跨域
app.all('*',function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Content-Length, Authorization, Accept, X-Requested-With , yourHeaderFeild');
    res.header('Access-Control-Allow-Methods', 'PUT, POST, GET, DELETE, OPTIONS');
    if (req.method == 'OPTIONS') {
      res.send(200); /让options请求快速返回/
    }
    else {
      next();
    }
});

// 首次进入 获取前端跳转页面
app.post('/oauth', function (req, res) {
  let data = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${req.body.returnUrl}&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect`
  res.json({data: data, msg: '跳转成功', code: 200})
});

// 获取用户信息
app.post('/login', function (req, res) {
  // 获取微信网页授权access_token
  axios.post(`https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appsecret}&code=${req.body.code}&grant_type=authorization_code`).then(t => {
    openId = t.data.openid

    // 获取微信用户信息
    let data = {
      token: '',
      return_url: req.body.returnUrl,
      data: {}
    }
    axios.post(`https://api.weixin.qq.com/sns/userinfo?access_token=${t.data.access_token}&openid=${t.data.openid}&lang=zh_CN`).then(i => {
      data.data = i.data
      res.json({data: data, msg: '获取微信用户信息成功', code: 200})
    })    
  })  
});

// 微信计算签名 JS-SDK配置  获取access_token  ticket
app.post('/wxConfig', function(req, res) {
  let config = {
      debug: false, // 开启调试模式,调用的所有api的返回值会在客户端alert出来，若要查看传入的参数，可以在pc端打开，参数信息会通过log打出，仅在pc端时才会打印。
      appId: appId, // 必填，公众号的唯一标识
      timestamp: '', // 必填，生成签名的时间戳
      nonceStr: '', // 必填，生成签名的随机串
      signature: '',// 必填，签名，见附录1
      jsApiList: [] // 必填，需要使用的JS接口列表，所有JS接口列表见附录2
  };
  redisClient.get('access_token', function(error, access) {    
    let access_token = access
    if (!access_token) {    
      axios.get(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appsecret}`).then(token => {
        let access_token = token.data.access_token
        redisClient.set('access_token', token.data.access_token)
        redisClient.expire('access_token', 7200)
        axios.get(`https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${access_token}&type=jsapi`).then(jsapi => {
          let c = sign(jsapi.data.ticket, req.body.url)
          config.timestamp = c.timestampu
          config.nonceStr = c.nonceStr
          config.signature = c.signature
          res.json({data: config, msg: '获取微信JS-SDK配置成功', code: 200})
        })        
      })
    } else {
      axios.get(`https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${access_token}&type=jsapi`).then(jsapi => {
        let c = sign(jsapi.data.ticket, req.body.url)
        config.timestamp = c.timestamp
        config.nonceStr = c.nonceStr
        config.signature = c.signature
        res.json({data: config, msg: '获取微信JS-SDK配置成功', code: 200})
      })
    }    
  }) 
})

// 出口
var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log('Example app listening at http://%s:%s', host, port);
});