import React from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../config/api';

function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = React.useState(value);
    React.useEffect(() => {
        const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
        return () => { clearTimeout(handler); };
    }, [value, delay]);
    return debouncedValue;
}

export default function SearchPage() {
    const navigate = useNavigate();
    const [query, setQuery] = React.useState('');
    const [results, setResults] = React.useState([]);
    const [loading, setLoading] = React.useState(false);
    const debouncedQuery = useDebounce(query, 500); // Wait 500ms after user stops typing

    React.useEffect(() => {
        const searchUsers = async () => {
            if (debouncedQuery.length < 2) {
                setResults([]);
                return;
            }
            setLoading(true);
            try {
                const response = await apiCall(`/api/users/search?query=${debouncedQuery}`);
                const data = await response.json();
                setResults(data);
            } catch (error) {
                console.error("Search failed:", error);
            } finally {
                setLoading(false);
            }
        };
        searchUsers();
    }, [debouncedQuery]);

    return (
        <div style={{ padding: '20px', maxWidth: '700px', margin: 'auto' }}>
            <button onClick={() => navigate('/')}>&larr; Back to Home</button>
            <h2>Search for Users</h2>
            <div style={{ marginBottom: '20px' }}>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name..."
                    style={{ width: '100%', padding: '10px', fontSize: '16px' }}
                />
            </div>

            {loading && <p>Searching...</p>}

            <div>
                {results.map(user => (
                    <div key={user.id} onClick={() => navigate(`/profile/${user.id}`)} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '10px', cursor: 'pointer', borderBottom: '1px solid #eee' }}>
                        <img src={user.profilePictureUrl} alt={user.displayName} style={{ width: 50, height: 50, borderRadius: '50%' }} />
                        <div>
                            <p style={{ margin: 0, fontWeight: 'bold' }}>{user.displayName}</p>
                            <p style={{ margin: 0, color: '#555' }}>@{user.username}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
