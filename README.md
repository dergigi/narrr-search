# Nostr Search

A simple search tool for Nostr built with Next.js and NDK (Nostr Development Kit).

## Features

- NIP-07 Authentication: Login with your Nostr browser extension (like nos2x, Alby, or Blockcore)
- Search Nostr content: Search notes and posts from your Nostr network
- Real-time results: See search results as they come in from connected relays

## Getting Started

### Prerequisites

- Node.js 18.0.0 or later
- npm or yarn
- A Nostr browser extension (like nos2x, Alby, or Blockcore) for authentication

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/simple-search.git
cd simple-search
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Start the development server
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application

## How to Use

1. Login with your Nostr browser extension by clicking the "Login with Extension" button
2. Enter your search query in the search box
3. Click the "Search" button to search for notes and posts
4. View the results below the search box

## Technology Stack

- [Next.js](https://nextjs.org/) - React framework for server-rendered applications
- [NDK (Nostr Development Kit)](https://github.com/nostr-dev-kit/ndk) - Library for building Nostr applications
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Headless UI](https://headlessui.com/) - Unstyled, accessible UI components
- [Heroicons](https://heroicons.com/) - Beautiful hand-crafted SVG icons

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
