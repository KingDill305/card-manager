
import { useEffect, useState } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

type Card = {
  _id: string;
  name: string;
  description: string;
};

type ApiResponse = {
  message?: string;
  error?: string;
  token?: string;
  username?: string;
  card?: Card;
  cards?: Card[];
};

function App() {
  // Authentication
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState('');
  const [loggedInUser, setLoggedInUser] = useState('');

  // Add card
  const [cardName, setCardName] = useState('');
  const [cardDescription, setCardDescription] = useState('');
  const [cardMessage, setCardMessage] = useState('');
  const [savingCard, setSavingCard] = useState(false);

  // View and search cards
  const [cards, setCards] = useState<Card[]>([]);
  const [search, setSearch] = useState('');
  const [loadingCards, setLoadingCards] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);

  // Edit and delete cards
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [busyCardId, setBusyCardId] = useState<string | null>(null);

  // Load cards whenever user logs in, searches, or saves changes
  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function loadCards() {
      setLoadingCards(true);

      try {
        const response = await fetch(
          `${API_URL}/api/cards?search=${encodeURIComponent(search)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        const data: ApiResponse = await response.json();

        if (!cancelled) {
          if (response.ok) {
            setCards(data.cards || []);
          } else {
            setCardMessage(data.error || 'Failed to load cards.');
          }
        }
      } catch {
        if (!cancelled) {
          setCardMessage('Could not load cards.');
        }
      } finally {
        if (!cancelled) setLoadingCards(false);
      }
    }

    loadCards();

    return () => {
      cancelled = true;
    };
  }, [token, search, refreshCount]);

  // REGISTER AND LOGIN
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    const endpoint = isRegistering ? 'register' : 'login';

    try {
      const response = await fetch(`${API_URL}/api/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        setMessage(data.error || 'Something went wrong.');
        return;
      }

      if (isRegistering) {
        setMessage('Account created successfully! Please sign in.');
        setIsRegistering(false);
        setPassword('');
      } else {
        if (!data.token || !data.username) {
          setMessage('Login response was incomplete.');
          return;
        }

        setToken(data.token);
        setLoggedInUser(data.username);
        setPassword('');
      }
    } catch {
      setMessage('Cannot connect to backend.');
    } finally {
      setLoading(false);
    }
  }

  // ADD CARD
  async function handleAddCard(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCardMessage('');
    setSavingCard(true);

    try {
      const response = await fetch(`${API_URL}/api/cards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: cardName,
          description: cardDescription
        })
      });

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        setCardMessage(data.error || 'Failed to create card.');
        return;
      }

      setCardMessage(`Card "${data.card?.name}" created successfully!`);
      setCardName('');
      setCardDescription('');
      setRefreshCount(previous => previous + 1);
    } catch {
      setCardMessage('Cannot connect to backend.');
    } finally {
      setSavingCard(false);
    }
  }

  // START EDITING
  function startEditing(card: Card) {
    setEditingId(card._id);
    setEditName(card.name);
    setEditDescription(card.description || '');
    setCardMessage('');
  }

  function cancelEditing() {
    setEditingId(null);
    setEditName('');
    setEditDescription('');
  }

  // SAVE EDIT
  async function handleSaveEdit(id: string) {
    setBusyCardId(id);
    setCardMessage('');

    try {
      const response = await fetch(`${API_URL}/api/cards/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editName,
          description: editDescription
        })
      });

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        setCardMessage(data.error || 'Failed to update card.');
        return;
      }

      setCardMessage('Card updated successfully!');
      cancelEditing();
      setRefreshCount(previous => previous + 1);
    } catch {
      setCardMessage('Could not connect to backend.');
    } finally {
      setBusyCardId(null);
    }
  }

  // DELETE CARD
  async function handleDeleteCard(id: string) {
    if (!window.confirm('Are you sure you want to delete this card?')) {
      return;
    }

    setBusyCardId(id);
    setCardMessage('');

    try {
      const response = await fetch(`${API_URL}/api/cards/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        setCardMessage(data.error || 'Failed to delete card.');
        return;
      }

      setCardMessage('Card deleted successfully!');
      if (editingId === id) cancelEditing();
      setRefreshCount(previous => previous + 1);
    } catch {
      setCardMessage('Could not connect to backend.');
    } finally {
      setBusyCardId(null);
    }
  }

  function switchMode() {
    setIsRegistering(!isRegistering);
    setUsername('');
    setPassword('');
    setMessage('');
  }

  // LOGOUT
  function handleLogout() {
    setToken('');
    setLoggedInUser('');
    setUsername('');
    setPassword('');
    setMessage('');
    setCardMessage('');
    setCardName('');
    setCardDescription('');
    setCards([]);
    setSearch('');
    cancelEditing();
    setIsRegistering(false);
  }

  // DASHBOARD
  if (token) {
    return (
      <div className="app-container">
        <div className="login-card">
          <h1>Card Manager</h1>
          <h2>Welcome, {loggedInUser}!</h2>
          <p>Create and manage your cards.</p>

          <h3>Add New Card</h3>

          <form onSubmit={handleAddCard}>
            <label htmlFor="cardName">Card Name</label>
            <input
              id="cardName"
              type="text"
              placeholder="Enter card name"
              value={cardName}
              onChange={e => setCardName(e.target.value)}
              maxLength={100}
              required
            />

            <label htmlFor="cardDescription">Description</label>
            <textarea
              id="cardDescription"
              placeholder="Enter card description"
              value={cardDescription}
              onChange={e => setCardDescription(e.target.value)}
              maxLength={1000}
              rows={3}
            />

            <button type="submit" disabled={savingCard}>
              {savingCard ? 'Saving...' : 'Add Card'}
            </button>
          </form>

          {cardMessage && <p className="message">{cardMessage}</p>}

          <h3>My Cards</h3>

          <input
            type="search"
            placeholder="Search cards..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search cards"
          />

          {loadingCards ? (
            <p>Loading cards...</p>
          ) : cards.length === 0 ? (
            <p>No cards found.</p>
          ) : (
            <div className="cards-list">
              {cards.map(card => (
                <div className="card-item" key={card._id}>
                  {editingId === card._id ? (
                    <div>
                      <h4>Edit Card</h4>

                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        maxLength={100}
                        placeholder="Card name"
                      />

                      <textarea
                        value={editDescription}
                        onChange={e => setEditDescription(e.target.value)}
                        maxLength={1000}
                        rows={3}
                        placeholder="Description"
                      />

                      <div className="card-actions">
                        <button
                          type="button"
                          disabled={
                            busyCardId === card._id || !editName.trim()
                          }
                          onClick={() => handleSaveEdit(card._id)}
                        >
                          {busyCardId === card._id
                            ? 'Saving...'
                            : 'Save Changes'}
                        </button>

                        <button type="button" onClick={cancelEditing}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h4>{card.name}</h4>
                      <p>{card.description || 'No description'}</p>

                      <div className="card-actions">
                        <button
                          type="button"
                          disabled={busyCardId === card._id}
                          onClick={() => startEditing(card)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={busyCardId === card._id}
                          onClick={() => handleDeleteCard(card._id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <button type="button" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </div>
    );
  }

  // LOGIN / REGISTER SCREEN
  return (
    <div className="app-container">
      <div className="login-card">
        <h1>Card Manager</h1>

        <p>
          {isRegistering
            ? 'Create your account'
            : 'Sign in to manage your cards'}
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            minLength={3}
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            minLength={isRegistering ? 8 : undefined}
            required
          />

          <button type="submit" disabled={loading}>
            {loading
              ? 'Please wait...'
              : isRegistering
                ? 'Create Account'
                : 'Sign In'}
          </button>
        </form>

        {message && <p className="message">{message}</p>}

        <p>
          {isRegistering
            ? 'Already have an account?'
            : "Don't have an account?"}{' '}

          <button type="button" onClick={switchMode}>
            {isRegistering ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
}

export default App;
