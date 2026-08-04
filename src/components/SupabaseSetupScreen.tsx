import { Database, AlertCircle } from 'lucide-react';

export function SupabaseSetupScreen() {
  return (
    <div className="min-h-screen bg-[#F4F5F6] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gray-900 flex items-center justify-center mb-4">
            <Database size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 text-center">Connect Supabase</h1>
          <p className="text-sm text-gray-400 mt-1 text-center">
            This app needs a Supabase project to store your data.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-50">
          <div className="flex items-start gap-2 bg-amber-50 text-amber-700 text-xs rounded-xl p-3 mb-4">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set.</span>
          </div>
          <ol className="text-sm text-gray-600 space-y-2.5 list-decimal list-inside">
            <li>Run the SQL in <code className="bg-gray-50 px-1 py-0.5 rounded text-xs">supabase/schema.sql</code> in your Supabase project's SQL editor.</li>
            <li>Copy <code className="bg-gray-50 px-1 py-0.5 rounded text-xs">.env.example</code> to <code className="bg-gray-50 px-1 py-0.5 rounded text-xs">.env</code> and fill in your project URL and anon key.</li>
            <li>Restart the dev server.</li>
          </ol>
          <p className="text-xs text-gray-400 mt-4">Full steps in <code className="bg-gray-50 px-1 py-0.5 rounded text-xs">supabase/README.md</code>.</p>
        </div>
      </div>
    </div>
  );
}
