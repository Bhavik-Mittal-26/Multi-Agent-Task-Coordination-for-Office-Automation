// // AI Chatbot Component for Multi-Agent Office
// class AIChatbot {
//   constructor() {
//     this.isOpen = false;
//     this.conversationId = null;
//     this.socket = null;
//     this.messages = [];
//     this.isTyping = false;
    
//     this.createChatbotUI();
//     this.setupEventListeners();
//     this.connectWebSocket();
//   }

//   createChatbotUI() {
//     // Create chatbot container
//     const chatbotContainer = document.createElement('div');
//     chatbotContainer.id = 'ai-chatbot';
//     chatbotContainer.innerHTML = `
//       <div class="chatbot-toggle" id="chatbot-toggle">
//         <div class="chatbot-icon">🤖</div>
//         <div class="chatbot-status">AI Assistant</div>
//       </div>
      
//       <div class="chatbot-window" id="chatbot-window">
//         <div class="chatbot-header">
//           <div class="chatbot-title">
//             <div class="chatbot-avatar">🤖</div>
//             <div class="chatbot-info">
//               <h3>AI Assistant</h3>
//               <span class="chatbot-subtitle">Multi-Agent Office Helper</span>
//             </div>
//           </div>
//           <div class="chatbot-controls">
//             <button class="chatbot-minimize" id="chatbot-minimize">−</button>
//             <button class="chatbot-close" id="chatbot-close">×</button>
//           </div>
//         </div>
        
//         <div class="chatbot-body">
//           <div class="chatbot-messages" id="chatbot-messages">
//             <div class="chatbot-welcome">
//               <div class="welcome-message">
//                 <h4>👋 Hello! I'm your AI Assistant</h4>
//                 <p>I can help you with:</p>
//                 <ul>
//                   <li>🤖 Agent configuration and usage</li>
//                   <li>🔗 Integration setup and troubleshooting</li>
//                   <li>📊 Analytics and performance insights</li>
//                   <li>⚙️ System settings and features</li>
//                   <li>❓ General questions about the platform</li>
//                 </ul>
//                 <p>What would you like to know?</p>
//               </div>
//             </div>
//           </div>
          
//           <div class="chatbot-typing" id="chatbot-typing" style="display: none;">
//             <div class="typing-indicator">
//               <span></span>
//               <span></span>
//               <span></span>
//             </div>
//             <span class="typing-text">AI is thinking...</span>
//           </div>
//         </div>
        
//         <div class="chatbot-footer">
//           <div class="chatbot-input-container">
//             <input type="text" id="chatbot-input" placeholder="Ask me anything about the system..." maxlength="1000">
//             <button id="chatbot-send" class="chatbot-send-btn">
//               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
//                 <line x1="22" y1="2" x2="11" y2="13"></line>
//                 <polygon points="22,2 15,22 11,13 2,9 22,2"></polygon>
//               </svg>
//             </button>
//           </div>
//           <div class="chatbot-quick-actions">
//             <button class="quick-action" data-question="How do I run an agent?">Run Agent</button>
//             <button class="quick-action" data-question="How do I connect Google Calendar?">Connect Calendar</button>
//             <button class="quick-action" data-question="How do I view analytics?">View Analytics</button>
//           </div>
//         </div>
//       </div>
//     `;

//     document.body.appendChild(chatbotContainer);

//     // Add CSS styles
//     this.addChatbotStyles();
//   }

//   addChatbotStyles() {
//     const styles = `
//       <style>
//         #ai-chatbot {
//           position: fixed;
//           bottom: 20px;
//           right: 20px;
//           z-index: 10000;
//           font-family: Inter, system-ui, -apple-system, sans-serif;
//         }

//         .chatbot-toggle {
//           width: 60px;
//           height: 60px;
//           background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
//           border-radius: 50%;
//           display: flex;
//           flex-direction: column;
//           align-items: center;
//           justify-content: center;
//           cursor: pointer;
//           box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
//           transition: all 0.3s ease;
//           position: relative;
//           overflow: hidden;
//         }

//         .chatbot-toggle:hover {
//           transform: scale(1.1);
//           box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
//         }

//         .chatbot-toggle::before {
//           content: '';
//           position: absolute;
//           top: -50%;
//           left: -50%;
//           width: 200%;
//           height: 200%;
//           background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.1), transparent);
//           transform: rotate(45deg);
//           transition: all 0.6s;
//         }

//         .chatbot-toggle:hover::before {
//           animation: shimmer 1.5s infinite;
//         }

//         @keyframes shimmer {
//           0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
//           100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
//         }

//         .chatbot-icon {
//           font-size: 24px;
//           margin-bottom: 2px;
//         }

//         .chatbot-status {
//           font-size: 10px;
//           color: white;
//           font-weight: 500;
//         }

//         .chatbot-window {
//           position: absolute;
//           bottom: 80px;
//           right: 0;
//           width: 380px;
//           height: 500px;
//           background: white;
//           border-radius: 16px;
//           box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
//           display: none;
//           flex-direction: column;
//           overflow: hidden;
//           border: 1px solid rgba(255, 255, 255, 0.2);
//         }

//         .chatbot-window.open {
//           display: flex;
//           animation: slideUp 0.3s ease-out;
//         }

//         @keyframes slideUp {
//           from {
//             opacity: 0;
//             transform: translateY(20px) scale(0.95);
//           }
//           to {
//             opacity: 1;
//             transform: translateY(0) scale(1);
//           }
//         }

//         .chatbot-header {
//           background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
//           color: white;
//           padding: 16px 20px;
//           display: flex;
//           justify-content: space-between;
//           align-items: center;
//         }

//         .chatbot-title {
//           display: flex;
//           align-items: center;
//           gap: 12px;
//         }

//         .chatbot-avatar {
//           width: 40px;
//           height: 40px;
//           background: rgba(255, 255, 255, 0.2);
//           border-radius: 50%;
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           font-size: 20px;
//         }

//         .chatbot-info h3 {
//           margin: 0;
//           font-size: 16px;
//           font-weight: 600;
//         }

//         .chatbot-subtitle {
//           font-size: 12px;
//           opacity: 0.8;
//         }

//         .chatbot-controls {
//           display: flex;
//           gap: 8px;
//         }

//         .chatbot-minimize,
//         .chatbot-close {
//           width: 24px;
//           height: 24px;
//           border: none;
//           background: rgba(255, 255, 255, 0.2);
//           color: white;
//           border-radius: 4px;
//           cursor: pointer;
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           font-size: 14px;
//           transition: background 0.2s;
//         }

//         .chatbot-minimize:hover,
//         .chatbot-close:hover {
//           background: rgba(255, 255, 255, 0.3);
//         }

//         .chatbot-body {
//           flex: 1;
//           display: flex;
//           flex-direction: column;
//           overflow: hidden;
//         }

//         .chatbot-messages {
//           flex: 1;
//           padding: 20px;
//           overflow-y: auto;
//           display: flex;
//           flex-direction: column;
//           gap: 16px;
//         }

//         .chatbot-welcome {
//           text-align: center;
//           padding: 20px 0;
//         }

//         .welcome-message h4 {
//           margin: 0 0 12px 0;
//           color: #333;
//           font-size: 18px;
//         }

//         .welcome-message p {
//           margin: 8px 0;
//           color: #666;
//           font-size: 14px;
//         }

//         .welcome-message ul {
//           text-align: left;
//           margin: 12px 0;
//           padding-left: 20px;
//         }

//         .welcome-message li {
//           margin: 6px 0;
//           color: #555;
//           font-size: 13px;
//         }

//         .message {
//           display: flex;
//           gap: 8px;
//           animation: fadeIn 0.3s ease-out;
//         }

//         @keyframes fadeIn {
//           from { opacity: 0; transform: translateY(10px); }
//           to { opacity: 1; transform: translateY(0); }
//         }

//         .message.user {
//           flex-direction: row-reverse;
//         }

//         .message-avatar {
//           width: 32px;
//           height: 32px;
//           border-radius: 50%;
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           font-size: 16px;
//           flex-shrink: 0;
//         }

//         .message.user .message-avatar {
//           background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
//           color: white;
//         }

//         .message.assistant .message-avatar {
//           background: #f0f0f0;
//           color: #666;
//         }

//         .message-content {
//           max-width: 80%;
//           padding: 12px 16px;
//           border-radius: 18px;
//           font-size: 14px;
//           line-height: 1.4;
//         }

//         .message.user .message-content {
//           background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
//           color: white;
//         }

//         .message.assistant .message-content {
//           background: #f8f9fa;
//           color: #333;
//           border: 1px solid #e9ecef;
//         }

//         .message-time {
//           font-size: 11px;
//           color: #999;
//           margin-top: 4px;
//           text-align: right;
//         }

//         .chatbot-typing {
//           padding: 16px 20px;
//           display: flex;
//           align-items: center;
//           gap: 12px;
//           background: #f8f9fa;
//           border-top: 1px solid #e9ecef;
//         }

//         .typing-indicator {
//           display: flex;
//           gap: 4px;
//         }

//         .typing-indicator span {
//           width: 8px;
//           height: 8px;
//           background: #667eea;
//           border-radius: 50%;
//           animation: typing 1.4s infinite ease-in-out;
//         }

//         .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
//         .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

//         @keyframes typing {
//           0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
//           40% { transform: scale(1); opacity: 1; }
//         }

//         .typing-text {
//           font-size: 13px;
//           color: #666;
//         }

//         .chatbot-footer {
//           border-top: 1px solid #e9ecef;
//           padding: 16px 20px;
//         }

//         .chatbot-input-container {
//           display: flex;
//           gap: 8px;
//           margin-bottom: 12px;
//         }

//         #chatbot-input {
//           flex: 1;
//           padding: 12px 16px;
//           border: 1px solid #ddd;
//           border-radius: 24px;
//           font-size: 14px;
//           outline: none;
//           transition: border-color 0.2s;
//         }

//         #chatbot-input:focus {
//           border-color: #667eea;
//         }

//         .chatbot-send-btn {
//           width: 40px;
//           height: 40px;
//           background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
//           border: none;
//           border-radius: 50%;
//           color: white;
//           cursor: pointer;
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           transition: transform 0.2s;
//         }

//         .chatbot-send-btn:hover {
//           transform: scale(1.05);
//         }

//         .chatbot-send-btn:disabled {
//           opacity: 0.5;
//           cursor: not-allowed;
//           transform: none;
//         }

//         .chatbot-quick-actions {
//           display: flex;
//           gap: 8px;
//           flex-wrap: wrap;
//         }

//         .quick-action {
//           padding: 6px 12px;
//           background: #f8f9fa;
//           border: 1px solid #e9ecef;
//           border-radius: 16px;
//           font-size: 12px;
//           color: #666;
//           cursor: pointer;
//           transition: all 0.2s;
//         }

//         .quick-action:hover {
//           background: #e9ecef;
//           color: #333;
//         }

//         /* Dark mode support */
//         @media (prefers-color-scheme: dark) {
//           .chatbot-window {
//             background: #1a1a1a;
//             border-color: #333;
//           }

//           .welcome-message h4 {
//             color: #fff;
//           }

//           .welcome-message p,
//           .welcome-message li {
//             color: #ccc;
//           }

//           .message.assistant .message-content {
//             background: #2a2a2a;
//             color: #fff;
//             border-color: #333;
//           }

//           .chatbot-typing {
//             background: #2a2a2a;
//             border-color: #333;
//           }

//           .typing-text {
//             color: #ccc;
//           }

//           .chatbot-footer {
//             border-color: #333;
//           }

//           #chatbot-input {
//             background: #2a2a2a;
//             border-color: #333;
//             color: #fff;
//           }

//           #chatbot-input:focus {
//             border-color: #667eea;
//           }

//           .quick-action {
//             background: #2a2a2a;
//             border-color: #333;
//             color: #ccc;
//           }

//           .quick-action:hover {
//             background: #333;
//             color: #fff;
//           }
//         }

//         /* Mobile responsiveness */
//         @media (max-width: 480px) {
//           .chatbot-window {
//             width: calc(100vw - 40px);
//             height: calc(100vh - 120px);
//             bottom: 80px;
//             right: 20px;
//           }
//         }
//       </style>
//     `;

//     document.head.insertAdjacentHTML('beforeend', styles);
//   }

//   setupEventListeners() {
//     // Toggle chatbot
//     document.getElementById('chatbot-toggle').addEventListener('click', () => {
//       this.toggleChatbot();
//     });

//     // Close chatbot
//     document.getElementById('chatbot-close').addEventListener('click', () => {
//       this.closeChatbot();
//     });

//     // Minimize chatbot
//     document.getElementById('chatbot-minimize').addEventListener('click', () => {
//       this.closeChatbot();
//     });

//     // Send message
//     document.getElementById('chatbot-send').addEventListener('click', () => {
//       this.sendMessage();
//     });

//     // Enter key to send
//     document.getElementById('chatbot-input').addEventListener('keypress', (e) => {
//       if (e.key === 'Enter' && !e.shiftKey) {
//         e.preventDefault();
//         this.sendMessage();
//       }
//     });

//     // Quick actions
//     document.querySelectorAll('.quick-action').forEach(btn => {
//       btn.addEventListener('click', (e) => {
//         const question = e.target.dataset.question;
//         document.getElementById('chatbot-input').value = question;
//         this.sendMessage();
//       });
//     });

//     // Click outside to close
//     document.addEventListener('click', (e) => {
//       const chatbot = document.getElementById('ai-chatbot');
//       if (this.isOpen && !chatbot.contains(e.target)) {
//         this.closeChatbot();
//       }
//     });
//   }

//   connectWebSocket() {
//     if (window.io) {
//       this.socket = window.io('http://localhost:5000');
      
//       this.socket.on('connect', () => {
//         console.log('Chatbot WebSocket connected');
//       });

//       this.socket.on('chatbot-response', (data) => {
//         this.handleResponse(data);
//       });

//       this.socket.on('disconnect', () => {
//         console.log('Chatbot WebSocket disconnected');
//       });
//     }
//   }

//   toggleChatbot() {
//     if (this.isOpen) {
//       this.closeChatbot();
//     } else {
//       this.openChatbot();
//     }
//   }

//   openChatbot() {
//     const window = document.getElementById('chatbot-window');
//     window.classList.add('open');
//     this.isOpen = true;
    
//     // Focus input
//     setTimeout(() => {
//       document.getElementById('chatbot-input').focus();
//     }, 300);

//     // Load conversation history if available
//     this.loadConversationHistory();
//   }

//   closeChatbot() {
//     const window = document.getElementById('chatbot-window');
//     window.classList.remove('open');
//     this.isOpen = false;
//   }

//   async sendMessage() {
//     const input = document.getElementById('chatbot-input');
//     const message = input.value.trim();
    
//     if (!message) return;

//     // Add user message to UI
//     this.addMessage('user', message);
    
//     // Clear input
//     input.value = '';
    
//     // Show typing indicator
//     this.showTyping();

//     try {
//       // Send via WebSocket if available
//       if (this.socket && this.socket.connected) {
//         this.socket.emit('chatbot-message', {
//           userId: this.getUserId(),
//           message: message,
//           conversationId: this.conversationId
//         });
//       } else {
//         // Fallback to HTTP API
//         await this.sendMessageViaAPI(message);
//       }
//     } catch (error) {
//       console.error('Failed to send message:', error);
//       this.hideTyping();
//       this.addMessage('assistant', 'Sorry, I\'m having trouble connecting right now. Please try again later.');
//     }
//   }

//   async sendMessageViaAPI(message) {
//     try {
//       const response = await fetch('/api/chatbot/message', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${localStorage.getItem('authToken')}`
//         },
//         body: JSON.stringify({
//           message: message,
//           conversationId: this.conversationId
//         })
//       });

//       if (response.ok) {
//         const data = await response.json();
//         this.conversationId = data.conversationId;
//         this.hideTyping();
//         this.addMessage('assistant', data.response);
//       } else {
//         throw new Error('API request failed');
//       }
//     } catch (error) {
//       throw error;
//     }
//   }

//   handleResponse(data) {
//     this.hideTyping();
//     this.conversationId = data.conversationId;
//     this.addMessage('assistant', data.response);
//   }

//   addMessage(sender, content) {
//     const messagesContainer = document.getElementById('chatbot-messages');
    
//     // Remove welcome message if it exists
//     const welcome = messagesContainer.querySelector('.chatbot-welcome');
//     if (welcome) {
//       welcome.remove();
//     }

//     const messageDiv = document.createElement('div');
//     messageDiv.className = `message ${sender}`;
    
//     const avatar = sender === 'user' ? '👤' : '🤖';
//     const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
//     messageDiv.innerHTML = `
//       <div class="message-avatar">${avatar}</div>
//       <div class="message-content">
//         ${this.formatMessage(content)}
//         <div class="message-time">${time}</div>
//       </div>
//     `;

//     messagesContainer.appendChild(messageDiv);
//     messagesContainer.scrollTop = messagesContainer.scrollHeight;

//     // Store message
//     this.messages.push({
//       sender,
//       content,
//       timestamp: new Date()
//     });
//   }

//   formatMessage(content) {
//     // Convert line breaks to HTML
//     return content.replace(/\n/g, '<br>');
//   }

//   showTyping() {
//     const typing = document.getElementById('chatbot-typing');
//     typing.style.display = 'flex';
//     this.isTyping = true;
//   }

//   hideTyping() {
//     const typing = document.getElementById('chatbot-typing');
//     typing.style.display = 'none';
//     this.isTyping = false;
//   }

//   getUserId() {
//     const token = localStorage.getItem('authToken');
//     if (token) {
//       try {
//         const payload = JSON.parse(atob(token.split('.')[1]));
//         return payload.userId;
//       } catch {
//         return null;
//       }
//     }
//     return null;
//   }

//   async loadConversationHistory() {
//     try {
//       const response = await fetch('/api/chatbot/conversations?limit=5', {
//         headers: {
//           'Authorization': `Bearer ${localStorage.getItem('authToken')}`
//         }
//       });

//       if (response.ok) {
//         const data = await response.json();
//         if (data.conversations.length > 0) {
//           const latestConversation = data.conversations[0];
//           this.conversationId = latestConversation.id;
          
//           // Load recent messages
//           const recentMessages = latestConversation.messages.slice(-10);
//           recentMessages.forEach(msg => {
//             this.addMessage(msg.role, msg.content);
//           });
//         }
//       }
//     } catch (error) {
//       console.error('Failed to load conversation history:', error);
//     }
//   }
// }

// // Initialize chatbot when DOM is loaded
// document.addEventListener('DOMContentLoaded', () => {
//   window.aiChatbot = new AIChatbot();
// });

// console.log('🤖 AI Chatbot loaded! Click the chatbot icon in the bottom right corner to start chatting.');
