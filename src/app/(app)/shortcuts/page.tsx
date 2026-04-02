import { redirect } from 'next/navigation'

export default function ShortcutsRedirectPage() {
  redirect('/settings/shortcuts')
}
