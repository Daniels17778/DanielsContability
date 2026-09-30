/**
 * Simple Event Emitter
 */

export class EventEmitter {
    constructor() {
        this.events = new Map();
    }

    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        this.events.get(event).add(callback);
        
        return () => this.off(event, callback);
    }

    off(event, callback) {
        if (!this.events.has(event)) return;
        this.events.get(event).delete(callback);
    }

    emit(event, data) {
        if (!this.events.has(event)) return;
        this.events.get(event).forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event ${event}:`, error);
            }
        });
    }

    once(event, callback) {
        const wrapper = (data) => {
            this.off(event, wrapper);
            callback(data);
        };
        this.on(event, wrapper);
    }

    removeAllListeners(event) {
        if (event) {
            this.events.delete(event);
        } else {
            this.events.clear();
        }
    }

    listenerCount(event) {
        if (!this.events.has(event)) return 0;
        return this.events.get(event).size;
    }
}

// Event types for type safety (documentation)
/**
 * @typedef {Object} StoreEvents
 * @property {string} change - Fired when any state changes
 * @property {string} reset - Fired when store is reset
 * @property {string} user:change - Fired when user changes
 * @property {string} accounts:change - Fired when accounts change
 * @property {string} transactions:change - Fired when transactions change
 * @property {string} categories:change - Fired when categories change
 * @property {string} budgets:change - Fired when budgets change
 * @property {string} goals:change - Fired when goals change
 * @property {string} debts:change - Fired when debts change
 * @property {string} reservedFunds:change - Fired when reserved funds change
 * @property {string} summary:change - Fired when summary changes
 * @property {string} toasts:change - Fired when toasts change
 * @property {string} modals:change - Fired when modals change
 * @property {string} loading:change - Fired when loading states change
 * @property {string} errors:change - Fired when errors change
 */

// Custom events for components
export const ComponentEvents = {
    // Navigation
    NAVIGATE: 'navigate',
    PAGE_CHANGED: 'page:changed',
    
    // Modals
    MODAL_OPEN: 'modal:open',
    MODAL_CLOSE: 'modal:close',
    
    // Forms
    FORM_SUBMIT: 'form:submit',
    FORM_VALIDATE: 'form:validate',
    
    // Data
    DATA_REFRESH: 'data:refresh',
    DATA_UPDATED: 'data:updated',
    
    // UI
    TOAST_SHOW: 'toast:show',
    LOADING_START: 'loading:start',
    LOADING_END: 'loading:end',
    
    // Auth
    LOGIN: 'auth:login',
    LOGOUT: 'auth:logout',
    REGISTER: 'auth:register'
};

export default EventEmitter;