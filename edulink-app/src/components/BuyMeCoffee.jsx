import React from 'react';
import './BuyMeCoffee.css';

const BuyMeCoffee = () => {
    return (
        <a 
            href="https://buymeacoffee.com/edulinkproject" 
            target="_blank" 
            rel="noopener noreferrer"
            className="buy-me-coffee-link"
            title="Support EduLink - Buy me a coffee"
        >
            <div className="coffee-icon">☕</div>
            <span className="coffee-text">Support Us</span>
        </a>
    );
};

export default BuyMeCoffee;
