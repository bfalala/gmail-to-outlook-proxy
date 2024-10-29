import { SendHorizonal } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export function Header() {
  return (
    <div className="text-center">
      <div className="flex justify-center mb-6">
        <Link href="/" className="flex items-center relative gap-2">
          <Image
            className="inline-flex items-center"
            src="/gmail.png"
            alt="Gmail Logo"
            width={64}
            height={48}
          />
          <div className="inline-block w-4 border-t-4 border-dotted border-gray-300" />
          <SendHorizonal
            className="stroke-gray-300"
            height={32}
            width={32}
            strokeWidth={2}
            absoluteStrokeWidth={true}
          />
          <div className="inline-block w-4 border-t-4 border-dotted border-gray-300" />
          <Image
            className="inline-flex items-center"
            src="/outlook.webp"
            alt="Outlook Logo"
            width={64}
            height={64}
          />
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
