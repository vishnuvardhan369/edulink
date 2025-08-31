# EduLink Poll Feature Implementation Guide

## Overview
The poll feature allows users to create interactive polls with up to 20 options, supporting both single and multiple choice voting. Polls are displayed alongside posts in the main feed and can be filtered separately.

## Database Schema

### Tables Created
1. **polls** - Stores poll metadata
2. **poll_options** - Stores individual poll options
3. **poll_votes** - Stores user votes

### Schema Setup
Run the SQL script to create the necessary tables:
```bash
cd backend
node -e "
const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const sql = fs.readFileSync('create-polls-schema.sql', 'utf8');
pool.query(sql).then(() => console.log('✅ Polls schema created'));
"
```

## Backend Endpoints

### Poll Management
- `POST /api/polls` - Create a new poll
- `GET /api/polls` - Get all polls
- `DELETE /api/polls/:pollId` - Delete a poll (owner only)

### Voting
- `POST /api/polls/:pollId/vote` - Submit vote(s) for a poll

### Combined Feed
- `GET /api/feed?type=all|posts|polls` - Get combined feed with filtering

## Frontend Components

### New Components Created
1. **Poll.jsx** - Displays individual polls with voting interface
2. **CreatePoll.jsx** - Form for creating new polls
3. **CreateContent.jsx** - Unified component with tabs for posts/polls

### Updated Components
- **HomePage.jsx** - Now displays both posts and polls with filtering

## Features

### Poll Creation
- Question (required, max 200 characters)
- Description (optional, max 500 characters)
- 2-20 options (max 100 characters each)
- Single or multiple choice voting
- Optional expiration date (1 day to 1 month)

### Voting System
- Real-time vote submission
- Vote change capability (replaces previous votes)
- Results display with percentages and vote counts
- Progress bars for visual representation

### Display Features
- Poll badge to distinguish from posts
- Expiration countdown
- Total vote count
- Owner delete capability
- Responsive design

## User Interface

### Feed Filtering
Users can filter the feed to show:
- All content (posts + polls)
- Posts only
- Polls only

### Create Content Tabs
- "Post" tab - Traditional post creation
- "Poll" tab - Poll creation with advanced options

### Poll Display
- Question prominently displayed
- Optional description
- Interactive voting options
- Real-time results after voting
- Meta information (votes, expiry, timestamp)

## Usage Flow

1. **Creating a Poll:**
   - Click "Poll" tab in create content section
   - Enter question and optional description
   - Add 2-20 options
   - Choose single/multiple vote setting
   - Optionally set expiration
   - Click "Create Poll"

2. **Voting:**
   - View poll in feed
   - Select option(s) based on poll settings
   - Click "Submit Vote"
   - View results immediately

3. **Managing Polls:**
   - Poll owners can delete their polls
   - Expired polls show results only
   - Vote changes allowed until expiration

## Responsive Design
- Mobile-optimized layouts
- Touch-friendly voting interface
- Collapsible poll options on small screens
- Adaptive tab design

## Security Features
- User authentication required
- Vote uniqueness enforced
- Owner-only poll deletion
- Input validation and sanitization

## Future Enhancements
- Poll sharing capabilities
- Advanced analytics
- Comment system for polls
- Poll templates
- Image/media in poll options
- Anonymous voting option
- Poll categories/tags

## Troubleshooting

### Common Issues
1. **Database connection timeout**: Ensure PostgreSQL is accessible
2. **Poll not creating**: Check user authentication and input validation
3. **Votes not recording**: Verify poll ID and user permissions
4. **UI not updating**: Check component state management

### Debug Steps
1. Check browser console for errors
2. Verify API responses in Network tab
3. Check backend logs for database errors
4. Validate component props and state

## File Structure
```
backend/
  - create-polls-schema.sql (database schema)
  - index.js (updated with poll endpoints)

edulink-app/src/
  components/
    - Poll.jsx (poll display component)
    - CreatePoll.jsx (poll creation form)
    - CreateContent.jsx (unified create interface)
  pages/
    - HomePage.jsx (updated with poll support)
  styles/
    - modern-ui.css (updated with poll styles)
```

This implementation provides a complete poll system that integrates seamlessly with the existing EduLink platform while maintaining the modern, responsive design aesthetic.
