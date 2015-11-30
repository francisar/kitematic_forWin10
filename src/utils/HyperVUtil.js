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
    if(util.exec(this.command() + " Get-WindowsOptionalFeature -Online| select State -First 1")=="Enabled"){
      return true;
    }
    else {
      return false;
    }
  },
  active: function () {
   if(util.exec(this.command() + " Get-Service | where {$_.Name -eq "vmms"}|select Status")=="Running"){
      return true;
    }
    else {
      return false;
    }
  },
  version: function () {
    return util.exec([this.command(), '-v']).then(stdout => {
      let matchlist = stdout.match(/(\d+\.\d+\.\d+).*/);
      if (!matchlist || matchlist.length < 2) {
        Promise.reject('VBoxManage -v output format not recognized.');
      }
      return Promise.resolve(matchlist[1]);
    }).catch(() => {
      return Promise.resolve(null);
    });
  },
  poweroffall: function () {
    return util.exec(this.command() + ' list runningvms | sed -E \'s/.*\\{(.*)\\}/\\1/\' | xargs -L1 -I {} ' + this.command() + ' controlvm {} poweroff');
  },
  mountSharedDir: function (vmName, pathName, hostPath) {
    return util.exec([this.command(), 'sharedfolder', 'add', vmName, '--name', pathName, '--hostpath', hostPath, '--automount']);
  },
  killall: function () {
    if (util.isWindows()) {
      return this.poweroffall().then(() => {
        return util.exec(['powershell.exe', '\"get-process VBox* | stop-process\"']);
      }).catch(() => {});
    } else {
      return this.poweroffall().then(() => {
        return util.exec(['pkill', 'VirtualBox']);
      }).then(() => {
        return util.exec(['pkill', 'VBox']);
      }).catch(() => {

      });
    }
  },
  vmExists: function (name) {
    return util.exec([this.command(), 'showvminfo', name]).then(() => {
      return true;
    }).catch((err) => {
      return false;
    });
  }
};

module.exports = VirtualBox;
