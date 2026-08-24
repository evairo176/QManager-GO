"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PayPalIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z" />
  </svg>
);

interface DonateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DonateDialog = ({ open, onOpenChange }: DonateDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm md:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Donate to QManager
          </DialogTitle>
          <DialogDescription>
            Support the development of this project.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 text-sm text-pretty font-medium leading-relaxed">
          <p>Hi, I&apos;m Rus 👋</p>
          <p>
            QuecManager is a little side project I maintain for free as part
            of Cameron&apos;s Toolkit. If you&apos;ve found it useful,
            consider supporting it with a small donation &mdash; it means a
            lot and keeps me going.
          </p>
          <p>Thanks so much for being awesome! 💙</p>
          <p className="text-muted-foreground text-xs">
            You can also{" "}
            <a
              href="https://github.com/sponsors/dr-dolomite"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              sponsor on GitHub
            </a>
            .
          </p>
        </div>
        <div className="mt-2 flex gap-2">
          <Button asChild size="sm" variant="outline">
            <a
              href="https://wise.com/pay/business/blackcatdev?currency=USD"
              target="_blank"
              rel="noopener noreferrer"
            >
              Donate via Wise
            </a>
          </Button>
          <Button
            asChild
            size="sm"
            className="bg-[#003087] hover:bg-[#002070] text-white"
          >
            <a
              href="https://paypal.me/iamrusss"
              target="_blank"
              rel="noopener noreferrer"
            >
              <PayPalIcon className="size-4" />
              PayPal
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DonateDialog;
