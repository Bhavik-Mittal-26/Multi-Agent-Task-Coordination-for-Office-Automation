#!/usr/bin/env node

/**
 * Setup script for Google Gemini API integration
 * This script helps you get a free Gemini API key and configure the chatbot
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🤖 Google Gemini API Setup for Multi-Agent Office Chatbot');
console.log('========================================================\n');

console.log('To get your FREE Gemini API key:');
console.log('1. Go to: https://makersuite.google.com/app/apikey');
console.log('2. Sign in with your Google account');
console.log('3. Click "Create API Key"');
console.log('4. Copy the generated API key\n');

rl.question('Enter your Gemini API key (or press Enter to use demo mode): ', (apiKey) => {
  if (apiKey.trim()) {
    // Create or update .env file
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    
    // Read existing .env if it exists
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Update or add GEMINI_API_KEY
    if (envContent.includes('GEMINI_API_KEY=')) {
      envContent = envContent.replace(/GEMINI_API_KEY=.*/, `GEMINI_API_KEY=${apiKey.trim()}`);
    } else {
      envContent += `\n# AI Configuration\nGEMINI_API_KEY=${apiKey.trim()}\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Gemini API key configured successfully!');
    console.log('🚀 Restart your server to use the new API key.');
  } else {
    console.log('ℹ️  Using demo mode - chatbot will use rule-based responses');
    console.log('💡 To enable AI responses, run this script again with a valid API key');
  }
  
  console.log('\n📖 How to use the chatbot:');
  console.log('1. Start your server: npm start');
  console.log('2. Open your browser to the application');
  console.log('3. Look for the 🤖 chatbot icon in the bottom-right corner');
  console.log('4. Click it to start chatting!\n');
  
  rl.close();
});
