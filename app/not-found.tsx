export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center text-center px-4">
      <div>
        <p className="text-zinc-600 text-sm uppercase tracking-widest mb-2">404</p>
        <h1 className="text-white text-2xl font-bold mb-2">Page not found</h1>
        <a href="/" className="text-[#EB0A1E] text-sm hover:underline">Back to tracker</a>
      </div>
    </div>
  )
}
