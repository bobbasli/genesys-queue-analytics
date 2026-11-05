import { createApp } from 'vue';
import App from './App.vue';
import './styles.css';
import { customerConfig } from './config.js';
document.documentElement.style.setProperty('--primary-color', customerConfig.primaryColor);
createApp(App).mount('#app');
