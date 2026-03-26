# BWT Voting Platform

A complete, production-ready anonymous multi-round voting platform. Built with React, Tailwind CSS v4, and Supabase.

## Features
- **Anonymous Voting**: Uses SHA-256 (User ID + Position ID) to completely obfuscate voter identities, even from admins.
- **Multi-Round System**: Configurable multi-stage voting process (e.g. President -> Secretary -> Treasurer).
- **Admin Dashboard**: Member management, permission controls, and state-machine-driven election control.
- **Real-time Status**: Live vote tracking & state synchronicity using Zustand.
- **Glassmorphic UI**: Beautiful, fully responsive theme powered by Tailwind CSS v4.

## Folder Structure
- `/client` - The Vite React Application
- `/supabase` - SQL Migration scripts for database & RLS

## Getting Started

### 1. Database Setup
1. Create a [Supabase](https://supabase.com) project.
2. Go to the SQL Editor and paste the contents of `supabase/migrations/00_init.sql` to initialize your schemas, tables, and Row-Level Security (RLS) policies.
3. In Authentication -> Providers, enable "Email" and disable "Confirm email" if you want simple OTP Magic Links.

### 2. Configure Environment
1. Copy `.env.example` to `.env` inside `/client`
2. Add your Supabase `URL` and `Anon Key`.

```bash
cd client
echo "VITE_SUPABASE_URL=your_url_here" > .env
echo "VITE_SUPABASE_ANON_KEY=your_key_here" >> .env
```

### 3. Running the App
Install dependencies and run the local development server:

```bash
cd client
npm install
npm run dev
```

### 4. Admin Setup
Because the schema defaults `is_admin` to false, you will need to manually set the first admin account via the Supabase SQL editor:
```sql
-- Register via the frontend first to create the members row, then:
UPDATE members SET is_admin = true, is_eligible = true WHERE email = 'YOUR_EMAIL@example.com';
```

## Security Considerations
- **Row Level Security (RLS)** is enabled for all tables.
- **Votes** are strictly `INSERT` only, with constraints blocking duplicate hashed attempts. Admins can view aggregate vote counts via the dashboard without any way to map a user to their vote.
