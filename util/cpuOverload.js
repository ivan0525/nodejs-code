const {platform} = process;
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const os = require('os');

let overloadTimes = 0;
let isOverload = false;
let currentCpuPercentage = 0;
let currentProbability = 0;
let removeCount = 0;

const maxValue = (10 * Math.exp(10)).toFixed(4);
const canAccessList = [];
const maxUser = 5000;


class CpuOverload {
  constructor(maxOverloadNum  = 30, maxCpuPercentage = 90, baseProbability=0.9, whiteList=[]) {
    this.maxOverloadNum = maxOverloadNum;
    this.maxCpuPercentage = maxCpuPercentage;
    this.baseProbability = baseProbability;
    this.whiteList = whiteList;
  }

  /**
   * @description 判断服务器当前是否可用
   */
  isAvailable(path, uuid = false) {
    if (path && this.whiteList.includes(path)) {
      return true;
    }
    if (uuid && canAccessList.includes(uuid)) {
      return true;
    }

    // cpu过载
    if (isOverload) {
      if (this._getRandomNum() <= currentProbability) {
        removeCount++;
        return false;
      }
    }

    // 需要将uuid加入到放行数组
    if (uuid) {
      // 超过上限则剔除第一个
      if (canAccessList.length > maxUser) {
        canAccessList.shift();
      }
      canAccessList.push(uuid)
      return true;
    }
  }

  /**
   * 定时校验服务器是否过载
   */
  async check() {
    /// 定时处理逻辑
    setInterval(async () => {
      try {
        const cpuInfo = await this._getProcessInfo();
        if(!cpuInfo) { // 异常不处理
          return;
        }
        currentCpuPercentage = cpuInfo;

        if(cpuInfo > this.maxCpuPercentage) { // 当 cpu 持续过高时，将当前的 overloadTimes 计数+1
          overloadTimes++;
        } else { // 当低于 cpu 设定值时，则认为服务负载恢复，因此将 overloadTimes 设置为 0
          overloadTimes = 0;
          return isOverload = false;
        }

        if(overloadTimes > this.maxOverloadNum){ //当持续出现 cpu 过载时，并且达到了我们设置上线，则需要进行请求丢弃了
          isOverload = true;
        }
        this._setProbability();
      } catch(err){
        console.log(err);
      }
    }, 2000);
  }

  /**
   * @description 获取丢弃概率
   */
  _setProbability() {
    let o = overloadTimes >= 100 ? 100 : overloadTimes;
    let c = currentCpuPercentage >= 100 ? 10 : currentCpuPercentage/10;
    currentProbability = ((0.1 * o) * Math.exp(c) / maxValue * this.baseProbability).toFixed(4);
  }

  /**
   * @description 获取进程信息
   * @return {Promise<string|boolean>}
   * @private
   */
  async _getProcessInfo() {
    let pidInfo, cpuInfo
    // windows平台
    if (platform === 'win32') {
      pidInfo = await this._getWmic();
    } else {
      // linux、mac平台
      pidInfo = await this._parseInOs()
    }
    cpuInfo = this._parseInOs(pidInfo);

    if (!cpuInfo) {
      return false;
    }
    return parseFloat(cpuInfo).toFixed(4);
  }

  /**
   *@description 获取一个概率值
   * @return {string}
   * @private
   */
  _getRandomNum() {
    return Math.random().toFixed(4);
  }

  async _getWmic() {
    const cols = 'IDProcess,Name,PercentProcessorTime,PrivateBytes,VirtualBytes';
    const cmd  = 'wmic path Win32_PerfFormattedData_PerfProc_Process get ' + cols + ' /format:csv';

    const { res, err } = await exec(cmd);
    if(err) {
      console.log(err);
    }
    return res;
  }

  /**
   *@description 使用ps命令获取进程信息
   * @return {Promise<boolean|*>}
   * @private
   */
  async _getPs() {
    const cmd = `ps -p ${process.pid} -o pcpu`
    // 执行结果
    const {res, err} = await exec(cmd);
    // 异常结果
    if (err) {
      console.log(err);
      return false;
    }
    return res;
  }

  async _parseInOs(pidInfo) {
    const lines = pidInfo.trim().split(os.EOL);
    if(!lines || lines.length < 2){
      return false;
    }
    let cpuStr = lines[1];
    return cpuStr.trim();
  }
}

module.exports = CpuOverload;
