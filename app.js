const http = require('http');
const {URL} = require('url');
const baseFn = require('./util/baseFun');
const CupOverload = require('./util/cpuOverload')

const cpuOverload = new CupOverload(10, 80, 0.8);

const routerMapping = {
  '/v1/contents' : {
    'controller' : 'content',
    'method' : 'list'
  },
  '/v1/test' : {
    'controller' : 'content',
    'method' : 'test'
  }
};

// 创建http服务
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const {pathname} = url;

  if (!routerMapping[pathname]) {
    return baseFn.setResInfo(res, false, 'path not found', null, 404);
  }

  // 请求拦截，避免cpu过载
  if (!cpuOverload.isAvailable(pathname)) {
    return baseFn.setResInfo(res, false, 'server error', null, 503);
  }
});

// 启动服务
server.listen('3000', () => {
  console.log('server start http://127.0.0.1:3000');
});

cpuOverload.check().then().catch((err) => {
  console.log(err);
})
