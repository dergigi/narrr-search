import LoginButton from "../components/LoginButton";
import SearchComponent from "../components/SearchComponent";
import SearchResults from "../components/SearchResults";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Nostr Search</h1>
          <LoginButton />
        </div>
        
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <p className="text-gray-600 mb-4">
            Welcome to Nostr Search. Login with your Nostr browser extension to search
            content across your connected relays.
          </p>
          <div className="text-sm text-gray-500">
            <p>
              This tool allows you to search notes and posts from your Nostr network.
              The search is performed across all relays your account is connected to.
            </p>
          </div>
        </div>
        
        <SearchComponent />
        <SearchResults />
      </div>
    </main>
  );
}
