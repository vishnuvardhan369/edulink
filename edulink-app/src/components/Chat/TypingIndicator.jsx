import './TypingIndicator.css';

const TypingIndicator = ({ users }) => {
    if (!users || users.length === 0) return null;

    const getTypingText = () => {
        if (users.length === 1) {
            return `${users[0].username} is typing...`;
        } else if (users.length === 2) {
            return `${users[0].username} and ${users[1].username} are typing...`;
        } else {
            return `${users[0].username} and ${users.length - 1} others are typing...`;
        }
    };

    return (
        <div className="typing-indicator">
            <div className="typing-bubble">
                <div className="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
            <div className="typing-text">
                {getTypingText()}
            </div>
        </div>
    );
};

export default TypingIndicator;