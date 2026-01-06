// frontend/src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import ChatPage from './pages/ChatPage'
import AdminPage from './pages/AdminPage'
import LoadingScreen from './components/LoadingScreen'

// Ленивая загрузка для оптимизации
// const ChatPage = lazy(() => import('./pages/ChatPage'))
// const AdminPage = lazy(() => import('./pages/AdminPage'))

function PrivateRoute({ children, requireAdmin = false }: { 
  children: React.ReactNode
  requireAdmin?: boolean 
}) {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/chat" replace />
  }

  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  if (user) {
    return <Navigate to="/chat" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <Router>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/login" element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } />
          
          <Route path="/chat" element={
            <PrivateRoute>
              <ChatPage />
            </PrivateRoute>
          } />
          
          <Route path="/admin/*" element={
            <PrivateRoute requireAdmin>
              <AdminPage />
            </PrivateRoute>
          } />
          
          <Route path="/" element={<Navigate to="/chat" replace />} />
          
          <Route path="*" element={
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
              <h1 className="text-2xl font-bold text-gray-800 mb-2">404</h1>
              <p className="text-gray-600">Страница не найдена</p>
              <a 
                href="/chat" 
                className="mt-4 text-[#0088cc] hover:text-[#0077b3]"
              >
                Вернуться к чатам
              </a>
            </div>
          } />
        </Routes>
      </Suspense>
    </Router>
  )
}

export default App
