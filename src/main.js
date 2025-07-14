import { mount } from 'svelte'
import App from './App.svelte'
import './app.css'

console.log('📱 Starting main.js');
console.log('📦 Importing App from ./App.svelte');

// Initialize the Svelte application
const app = mount(App, {
    target: document.getElementById('app'),
    props: {
        // Initial props can be passed here if needed
    }
})

console.log('✅ App initialized successfully');

// Handle hot module replacement in development
if (import.meta.hot) {
    import.meta.hot.accept()
    import.meta.hot.dispose(() => {
        app.$destroy()
    })
}

export default app