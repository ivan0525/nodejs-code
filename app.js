const http = require('http');
const {URL} = require('url');

// 创建http服务
const server = http.createServer((req, res) => {

});

// 启动服务
server.listen('3000', () => {
  console.log('server start http://127.0.0.1"3000');
});
