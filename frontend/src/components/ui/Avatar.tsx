// frontend/src/components/ui/Avatar.tsx
interface AvatarProps {
  src?: string | null
  alt?: string
  name?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  status?: 'online' | 'offline' | 'away'
  className?: string
}

const Avatar = ({
  src,
  alt = '',
  name = '',
  size = 'md',
  status,
  className = ''
}: AvatarProps) => {
  const sizes = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl'
  }

  const statusSizes = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
    xl: 'w-4 h-4'
  }

  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-gray-400',
    away: 'bg-yellow-500'
  }

  const initials = name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className={`relative inline-block ${sizes[size]} ${className}`}>
      {src ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full rounded-full object-cover"
        />
      ) : (
        <div className="w-full h-full rounded-full bg-gradient-to-br from-[#0088cc] to-[#00a2ff] flex items-center justify-center text-white font-semibold">
          {initials}
        </div>
      )}

      {status && (
        <span className={`
          absolute bottom-0 right-0
          rounded-full border-2 border-white
          ${statusColors[status]} ${statusSizes[size]}
        `} />
      )}
    </div>
  )
}

export default Avatar