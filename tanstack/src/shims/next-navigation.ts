import { useLocation, useNavigate } from 'react-router-dom'

export function useRouter() {
  const navigate = useNavigate()

  return {
    push: (to: string) => navigate(to),
    replace: (to: string) => navigate(to, { replace: true }),
    back: () => window.history.back(),
  }
}

export function usePathname() {
  return useLocation().pathname
}
