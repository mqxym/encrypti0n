// AppState.js
class AppState {
    constructor() {
      this.state = {
        isEncrypting: false,
        currentView: 'text',
        isLocked: false,
        actionInProgress: false
      };
      this.listeners = [];
    }
  
    subscribe(listener) {
      this.listeners.push(listener);
    }
  
    unsubscribe(listener) {
      this.listeners = this.listeners.filter(l => l !== listener);
    }
  
    setState(newState) {
      this.state = { ...this.state, ...newState };
      this.notifyListeners();
    }
  
    notifyListeners() {
      for (const listener of this.listeners) {
        listener(this.state);
      }
    }
  }
  
  const appState = new AppState();
  
  export default appState;