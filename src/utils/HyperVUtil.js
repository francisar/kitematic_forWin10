import fs from 'fs';
import path from 'path';
import util from './Util';
import Promise from 'bluebird';


var HyperV = {
  command: function () {
    if (util.isWindows()) {
      return "powershell.exe";
    } else {
      return '/Applications/VirtualBox.app/Contents/MacOS/VBoxManage';
    }
  },
  installed: function () {
    return util.exec([this.command() ,"Get-WindowsOptionalFeature -Online| select -ExpandProperty State -First 1"]).then(stdout => {
       if(stdout=="Enabled"){
            return true;
       }
      return false;
    }).catch(() => {
      return false;
    });
  },
  active: function () {
   return util.exec([this.command() , ' Get-Service | where {$_.Name -eq "vmms"}|select -ExpandProperty Status']).then(stdout => {
      if(stdout == "Running"){
        return true;
      }
        return false;
    }).catch(() => {
      return false;
    });
  },
  getNetadapter: function(){
    return util.exec([this.command()," get-netadapter | where {$_.Status -eq 'Up'}|select  -ExpandProperty Name -First 1"]).then(stdout => {
       let matchlist = stdout;
       if (!matchlist) {
        Promise.reject('hyperv output format not recognized.');
      }
      return Promise.resolve(matchlist);
    }).catch(() => {
      return Promise.resolve(null);
    });

  },
  async createVswitch(){
      let netadapter = await this.getNetadapter();
      if(!netadapter){
        return Promise.resolve(null);
      }
      return util.exec([this.command(),"New-VMSwitch default  -NetAdapterName "+netadapter]).then(stdout => {
         return Promise.resolve(stdout);
         }).catch((stderr) => {
         return Promise.resolve(null);
        });
  },
  version: function () {
    return util.exec([this.command() , "  Get-WmiObject -Class Win32_OperatingSystem|select  -ExpandProperty Version"]).then(stdout => {
      var matchlist = stdout;
      if (!matchlist) {
        Promise.reject('hyperv output format not recognized.');
      }
      return Promise.resolve(matchlist);
    }).catch(() => {
      return Promise.resolve(null);
    });
  },
  poweroffall: function () {
    return util.exec(this.command() + '\" get-vm |stop-vm\"');
  },
  //mountSharedDir: function (vmName, pathName, hostPath) {
  //  return util.exec([this.command(), 'sharedfolder', 'add', vmName, '--name', pathName, '--hostpath', hostPath, '--automount']);
  //},
  killall: function () {
    if (util.isWindows()) {
      return this.poweroffall().then(() => {
        return util.exec(['powershell.exe', '\"Get-Service | where {$_.Name -eq "vmms"}|start-service\"']);
      }).catch(() => {});
    }
  },
  vmIsRun: function (name) {
    return util.exec([this.command(), 'get-vm '+name+' |select  -ExpandProperty State']).then(stdout => {
     if(State=='Running'){
       return true;
      }
      return false;
    }).catch((err) => {
      return false;
    });
  },
  vmStart: function (name) {
    return util.exec([this.command(), 'start-vm '+name]);
  },
  vmExists: function (name) {
    return util.exec([this.command(), 'get-vm '+name+' |select  -ExpandProperty Name']).then(stdout => {
       return true;
    }).catch((err) => {
      return false;
    });
  },
  hyperVLogs: function () {
    return util.exec(["powershell.exe" ," Get-EventLog -Source *hyper* -LogName System -Newest 10"]).then(stdout => {
        return Promise.resolve(stdout);
    }).catch((err) => {
        return Promise.resolve(null);
    });
  }
};

module.exports = HyperV;
