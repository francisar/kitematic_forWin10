import alt from '../alt';

class ContainerServerActions {
  constructor () {
    this.generateActions(
      'added',
      'allUpdated',
      'destroyed',
      'error',
      'muted',
      'pending',
      'progress',
      'started',
      'unmuted',
      'updated',
      'waiting',
      'kill',
      'stopped'
    );
  }
}

export default alt.createActions(ContainerServerActions);
