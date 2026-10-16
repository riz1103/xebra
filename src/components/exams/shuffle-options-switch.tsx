import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/** Exam setting: show each examinee the answer choices in a different order. */
export function ShuffleOptionsSwitch({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Switch id="shuffleOptions" checked={checked} onCheckedChange={onCheckedChange} />
      <div>
        <Label htmlFor="shuffleOptions">Shuffle answer choices</Label>
        <p className="text-xs text-muted-foreground">
          Each examinee sees the choices of questions with 3 or more options in a different order. Choices such as
          &quot;All of the above&quot; stay last, and True/False questions are not shuffled.
        </p>
      </div>
    </div>
  );
}

/** Exam setting: let examinees who pass download a verifiable certificate. */
export function CertificatesSwitch({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Switch id="certificatesEnabled" checked={checked} onCheckedChange={onCheckedChange} />
      <div>
        <Label htmlFor="certificatesEnabled">Certificates for passing</Label>
        <p className="text-xs text-muted-foreground">
          Examinees who pass can download a certificate with a QR code that anyone can scan to verify it.
        </p>
      </div>
    </div>
  );
}
