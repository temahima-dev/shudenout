import Link from "next/link";

export default function Header() {
  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center">
          <Link 
            href="/" 
            className="text-2xl font-bold text-blue-600 hover:text-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
          >
            <span className="text-blue-600">ShuDen</span>
            <span className="text-gray-800">Out</span>
          </Link>
          <span className="ml-3 text-sm text-gray-500 hidden sm:inline">
            終電あとホテル
          </span>
        </div>
      </div>
    </header>
  );
}
