import { Button } from "@/components/ui/button";
import { Share2, Copy, Check, Facebook, Twitter, Send, Mail } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { trackShare } from "@/lib/analytics";

interface ProductShareButtonsProps {
  productName: string;
  productUrl: string;
}

export function ProductShareButtons({ productName, productUrl }: ProductShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const fullUrl = `${window.location.origin}${productUrl}`;
  const text = `Check out ${productName} on ShopHub!`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullUrl);
    trackShare("copy_link", { product_name: productName });
    setCopied(true);
    toast({ title: "Link copied!", description: "Share it with your friends." });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    trackShare("whatsapp", { product_name: productName });
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${fullUrl}`)}`, "_blank");
  };

  const shareFacebook = () => {
    trackShare("facebook", { product_name: productName });
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}`, "_blank", "noopener,width=600,height=500");
  };

  const shareTwitter = () => {
    trackShare("twitter", { product_name: productName });
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(fullUrl)}`, "_blank", "noopener,width=600,height=500");
  };

  const shareTelegram = () => {
    trackShare("telegram", { product_name: productName });
    window.open(`https://t.me/share/url?url=${encodeURIComponent(fullUrl)}&text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  const shareEmail = () => {
    trackShare("email", { product_name: productName });
    window.location.href = `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(`${text}\n\n${fullUrl}`)}`;
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: productName, text, url: fullUrl });
        trackShare("native", { product_name: productName });
      } catch {}

    } else {
      handleCopy();
    }
  };

  return (
    <div className="flex items-center flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={shareWhatsApp} className="gap-1.5 text-xs" aria-label="Share on WhatsApp">
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        <span className="hidden sm:inline">WhatsApp</span>
      </Button>
      <Button variant="outline" size="sm" onClick={shareFacebook} className="gap-1.5 text-xs" aria-label="Share on Facebook">
        <Facebook className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Facebook</span>
      </Button>
      <Button variant="outline" size="sm" onClick={shareTwitter} className="gap-1.5 text-xs" aria-label="Share on X/Twitter">
        <Twitter className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">X</span>
      </Button>
      <Button variant="outline" size="sm" onClick={shareTelegram} className="gap-1.5 text-xs" aria-label="Share on Telegram">
        <Send className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Telegram</span>
      </Button>
      <Button variant="outline" size="sm" onClick={shareEmail} className="gap-1.5 text-xs" aria-label="Share via Email">
        <Mail className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Email</span>
      </Button>
      <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 text-xs" aria-label="Copy link">
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">{copied ? "Copied" : "Copy Link"}</span>
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={shareNative} aria-label="Share product">
        <Share2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
