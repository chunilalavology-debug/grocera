import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, X, ChevronRight } from 'lucide-react';
import '../styles/components/ChatWidget.css';

const CHAT_FAQ = [
  {
    id: 'availability',
    question: 'How do I check product availability?',
    answer: 'Product availability is shown on each product page and in the shop grid. Items marked "Out of stock" cannot be added to cart. Stock is updated regularly—check back soon for restocks.',
  },
  {
    id: 'categories',
    question: 'What categories do you offer?',
    answer: 'We offer Indian, American, Chinese, and Turkish groceries. Use the main category tabs on the Shop page, then pick a subcategory (e.g. Spices, Noodles, Desserts) to browse. You can also use "Browse All Categories" in the header.',
  },
  {
    id: 'delivery',
    question: 'What are the delivery options and times?',
    answer: 'We provide nationwide delivery. Orders are delivered within 24-48 hours. Exact options and time slots are shown at checkout.',
  },
  {
    id: 'returns',
    question: 'What is your return or refund policy?',
    answer: 'Please see our Refund Policy page for full details. Generally, contact us within 24 hours of delivery for issues. We’ll help with replacements or refunds where applicable.',
  },
  {
    id: 'contact',
    question: 'How can I reach customer support?',
    answer: 'You can call us at (934) 260-4322 or use the Contact Us page to send a message. We’re here to help with orders, products, and any questions.',
  },
];

function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [showContactPrompt, setShowContactPrompt] = useState(false);
  const [lastQuestionId, setLastQuestionId] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleQuestionClick = (item) => {
    const isSameQuestion = lastQuestionId === item.id;
    setLastQuestionId(item.id);

    setMessages((prev) => {
      const next = [
        ...prev,
        { role: 'user', text: item.question },
        { role: 'bot', text: item.answer },
      ];
      const userMessageCount = next.filter((m) => m.role === 'user').length;
      if (isSameQuestion || userMessageCount >= 2) {
        setShowContactPrompt(true);
      }
      return next;
    });
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const hasReplied = messages.length > 0;
  const quickQuestions = CHAT_FAQ.filter((q) => q.id !== 'contact');

  return (
    <div className="chat-widget">
      {isOpen && (
        <div className="chat-widget__panel">
          <div className="chat-widget__header">
            <h3 className="chat-widget__title">How can we help?</h3>
            <button
              type="button"
              className="chat-widget__close"
              onClick={handleClose}
              aria-label="Close chat"
            >
              <X size={20} />
            </button>
          </div>

          <div className="chat-widget__body">
            {messages.length === 0 ? (
              <div className="chat-widget__welcome">
                <p className="chat-widget__welcome-text">Choose a topic below for quick answers:</p>
                <div className="chat-widget__quick-list">
                  {quickQuestions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="chat-widget__quick-btn"
                      onClick={() => handleQuestionClick(item)}
                    >
                      <span>{item.question}</span>
                      <ChevronRight size={16} className="chat-widget__quick-icon" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="chat-widget__messages">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`chat-widget__msg chat-widget__msg--${msg.role}`}
                  >
                    <span className="chat-widget__msg-text">{msg.text}</span>
                  </div>
                ))}
                {hasReplied && (
                  <div className="chat-widget__quick-list chat-widget__quick-list--inline">
                    <p className="chat-widget__quick-label">More questions?</p>
                    {quickQuestions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="chat-widget__quick-btn chat-widget__quick-btn--small"
                        onClick={() => handleQuestionClick(item)}
                      >
                        {item.question}
                      </button>
                    ))}
                  </div>
                )}
                {showContactPrompt && (
                  <div className="chat-widget__contact-prompt">
                    <p className="chat-widget__contact-text">Need more help? Our team is here for you.</p>
                    <Link
                      to="/contact"
                      className="chat-widget__contact-btn"
                      onClick={handleClose}
                    >
                      Contact Us
                      <ChevronRight size={18} />
                    </Link>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        className={`chat-widget__toggle ${isOpen ? 'chat-widget__toggle--open' : ''}`}
        onClick={() => setIsOpen((o) => !o)}
        aria-label={isOpen ? 'Close help' : 'Open help'}
      >
        <MessageCircle size={24} strokeWidth={1.5} />
      </button>
    </div>
  );
}

export default ChatWidget;
