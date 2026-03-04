import { Link } from 'react-router-dom'
import { AlertCircle, Home, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorFallbackProps {
  error: Error
  resetErrorBoundary?: () => void
}

export function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-500/10 p-4">
            <AlertCircle className="h-12 w-12 text-red-400" aria-hidden />
          </div>
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white mb-2">Something went wrong</h1>
          <p className="text-zinc-400 text-sm">
            We hit an unexpected error. You can try again or head back to the home page.
          </p>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <pre className="text-left text-xs bg-zinc-900 border border-zinc-800 rounded-lg p-4 overflow-auto max-h-32 text-zinc-500">
            {error.message}
          </pre>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {resetErrorBoundary && (
            <Button
              variant="outline"
              className="border-zinc-600 text-zinc-200 hover:bg-zinc-800"
              onClick={resetErrorBoundary}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try again
            </Button>
          )}
          <Button asChild className="bg-white text-black hover:bg-zinc-200">
            <Link to="/">
              <Home className="h-4 w-4 mr-2" />
              Go to home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
