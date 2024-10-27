import { Mail } from "lucide-react";
import Link from "next/link";

export function Header() {
  return (
    <div className="text-center">
      <div className="flex justify-center mb-6">
        <Link href="/">
          <Mail className="h-12 w-12 text-blue-600" />
        </Link>
      </div>
      <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl mb-6">
        Gmail to Outlook.com SMTP Proxy
      </h1>
      <p className="text-xl text-gray-600 max-w-3xl mx-auto">
        Restore Gmail's "Send mail as" functionality for your Outlook.com
        account
      </p>
    </div>
  );
}
