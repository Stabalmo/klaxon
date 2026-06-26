// Static Klaxon logo. Drop the file at public/klaxon-logo.png.

export function LogoMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/klaxon-logo.png"
      alt="Klaxon"
      className={`${className ?? ""} object-contain`}
    />
  )
}
