
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'
import { ConversationProvider } from './context/ConversationContext'

// Layouts
import Layout from './components/Layout'

// Pages
import HomePage from './pages/HomePage'
import SignInPage from './pages/SignInPage'
import NotFoundPage from './pages/NotFoundPage'

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  )
}

// Router configuration
const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ConversationProvider>
        <Layout />
      </ConversationProvider>
    ),
    children: [
      {
        index: true,
        element: (
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'signin',
        element: <SignInPage />,
      },
      {
        path: '404',
        element: <NotFoundPage />,
      },
      {
        path: '*',
        element: <Navigate to="/404" replace />,
      },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
