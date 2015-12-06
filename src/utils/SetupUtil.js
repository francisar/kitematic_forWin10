import _ from 'underscore';
import fs from 'fs';
import path from 'path';
import Promise from 'bluebird';
import util from './Util';
import bugsnag from 'bugsnag-js';
import virtualBox from './VirtualBoxUtil';
import hyperv from './HyperVUtil';
import setupServerActions from '../actions/SetupServerActions';
import metrics from './MetricsUtil';
import machine from './DockerMachineUtil';
import docker from './DockerUtil';
import router from '../router';

let _retryPromise = null;
let _timers = [];

export default {
  simulateProgress (estimateSeconds) {
    this.clearTimers();
    var times = _.range(0, estimateSeconds * 1000, 200);
    _.each(times, time => {
      var timer = setTimeout(() => {
        setupServerActions.progress({progress: 100 * time / (estimateSeconds * 1000)});
      }, time);
      _timers.push(timer);
    });
  },

  clearTimers () {
    _timers.forEach(t => clearTimeout(t));
    _timers = [];
  },

  retry (removeVM) {
    metrics.track('Retried Setup', {
      removeVM
    });

    router.get().transitionTo('loading');
    if (removeVM) {
      machine.rm().finally(() => {
        _retryPromise.resolve();
      });
    } else {
      _retryPromise.resolve();
    }
  },

  pause () {
    _retryPromise = Promise.defer();
    return _retryPromise.promise;
  },

  async setup () {
    let hypervVersion = null;
    let machineVersion = null;
    while (true) {
      try {
        setupServerActions.started({started: false});
        let hypervInstalled = hyperv.installed();
        let machineInstalled = machine.installed();
        if (!hypervInstalled || !machineInstalled) {
          router.get().transitionTo('setup');
          if (!hypervInstalled) {
             setupServerActions.error({error: 'HyperV is not installed. Please install it via the Control Panal.'});
          } else {
             setupServerActions.error({error: 'Docker Machine is not installed. Please install it via the Docker Toolbox.'});
          }
          let hypervActived = hyperv.active();
          if(!hypervActived){
             setupServerActions.error({error: 'HyperV is not Running. Please Start it.'});
          }
          this.clearTimers();
          await this.pause();
          continue;
        }

        hypervVersion = await hyperv.version();
        machineVersion = await machine.version();

        setupServerActions.started({started: true});
        metrics.track('Started Setup', {
          hypervVersion,
          machineVersion
        });

       let exists = await hyperv.vmExists(machine.name()) && fs.existsSync(path.join(util.home(), '.docker', 'machine', 'machines', machine.name()));
       //let exists = await machine.exists() && fs.existsSync(path.join(util.home(), '.docker', 'machine', 'machines', machine.name()));
        if (!exists) {
          router.get().transitionTo('setup');
          setupServerActions.started({started: true});
          this.simulateProgress(60);
          try {
            await machine.rm();
          } catch (err) {}
          await machine.create();
          let state = await machine.status();
          if (state !== 'Running') {
            if (state === 'Saved') {
              router.get().transitionTo('setup');
              this.simulateProgress(10);
            } else if (state === 'Stopped') {
              router.get().transitionTo('setup');
              this.simulateProgress(25);
            }
            await machine.start();
          }
        } else {
          let state = await machine.status();
          if (state !== 'Running') {
            if (state === 'Saved') {
              router.get().transitionTo('setup');
              this.simulateProgress(10);
            } else if (state === 'Stopped') {
              router.get().transitionTo('setup');
              this.simulateProgress(25);
            }
            await machine.start();
          }
        }

        // Try to receive an ip address from machine, for at least to 80 seconds.
        let tries = 80, ip = null;
        while (!ip && tries > 0) {
          try {
            console.log('Trying to fetch machine IP, tries left: ' + tries);
            ip = await machine.ip();
            tries -= 1;
            await Promise.delay(2000);
          } catch (err) {}
        }

        if (ip) {
          docker.setup(ip, machine.name());
        } else {
          throw new Error('Could not determine IP from docker-machine.');
        }
        let certDir = path.join(util.home(), '.docker/machine/machines/',  machine.name());
        if (!fs.existsSync(certDir)) {
         throw new Error('Certificate directory does not exist');
        }
        let certcheck = path.join(certDir, 'cert.pem');
        if(!fs.existsSync(certcheck)){
        alert("here");
          docker.setup(ip, machine.name());
        }
        break;
      } catch (error) {
        router.get().transitionTo('setup');
        metrics.track('Setup Failed', {
          hypervVersion,
          machineVersion
        });
        setupServerActions.error({error});

        let message = error.message.split('\n');
        let lastLine = message.length > 1 ? message[message.length - 2] : 'Docker Machine encountered an error.';
        let hyperVLogs = machine.hyperVLogs();
        bugsnag.notify('Setup Failed', lastLine, {
          'Docker Machine Logs': error.message,
          'hyperVLogs': virtualBoxLogs,
          'Windows Version': hypervVersion,
          'Machine Version': machineVersion,
          groupingHash: machineVersion
        }, 'info');

        this.clearTimers();
        await this.pause();
      }
    }


    metrics.track('Setup Finished', {
      hypervVersion,
      machineVersion
    });
  }
};
