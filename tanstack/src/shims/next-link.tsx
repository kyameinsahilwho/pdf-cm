import type React from 'react'
import { Link as RouterLink } from 'react-router-dom'

type NextLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string
  children: React.ReactNode
}

export default function NextLink({ href, children, ...rest }: NextLinkProps) {
  const isInternal = href.startsWith('/') && !href.startsWith('//')

  if (isInternal) {
    return (
      <RouterLink to={href} {...(rest as Record<string, unknown>)}>
        {children}
      </RouterLink>
    )
  }

  return (
    <a href={href} {...rest}>
      {children}
    </a>
  )
}
