import { useState } from "react";
import { Instagram, Twitter, Facebook, Github, Linkedin, Youtube, Mail, MapPin } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ContactModal } from "./ContactModal";

const SOCIALS = [
  { icon: Instagram, href: "https://instagram.com", label: "Instagram" },
  { icon: Twitter, href: "https://twitter.com", label: "X / Twitter" },
  { icon: Facebook, href: "https://facebook.com", label: "Facebook" },
  { icon: Linkedin, href: "https://linkedin.com", label: "LinkedIn" },
  { icon: Youtube, href: "https://youtube.com", label: "YouTube" },
  { icon: Github, href: "https://github.com", label: "GitHub" },
];

export function SiteFooter() {
  const [contactOpen, setContactOpen] = useState(false);
  return (
    <footer className="mt-24 border-t border-border bg-card/60">
      <div className="max-w-6xl mx-auto px-6 py-12 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <MapPin size={16} strokeWidth={2.5} />
            </span>
            BlockBeacon
          </div>
          <p className="mt-3 text-sm text-muted-foreground max-w-sm">
            A hyper-local map that helps neighbors surface street-level problems — potholes, broken lights, litter — and rally to get them fixed.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {SOCIALS.map(({ icon: Icon, href, label }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="h-9 w-9 rounded-full border border-border bg-background grid place-items-center hover:bg-secondary hover:text-primary transition"
              >
                <Icon size={16} />
              </a>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold">Community</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/map" className="hover:text-foreground">Explore the map</Link></li>
            <li><Link to="/auth" className="hover:text-foreground">Create an account</Link></li>
            <li>
              <button onClick={() => setContactOpen(true)} className="hover:text-foreground text-left">
                Contact us
              </button>
            </li>
            <li><a href="mailto:hello@blockbeacon.app" className="hover:text-foreground inline-flex items-center gap-1"><Mail size={12} /> hello@blockbeacon.app</a></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold">Resources</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><a href="/sitemap.xml" className="hover:text-foreground">Sitemap</a></li>
            <li><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Map data © OpenStreetMap</a></li>
            <li><button onClick={() => setContactOpen(true)} className="hover:text-foreground text-left">Report a bug</button></li>
            <li><button onClick={() => setContactOpen(true)} className="hover:text-foreground text-left">Partner with us</button></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/50 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} BlockBeacon. Built for neighbors, by neighbors.
      </div>
      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </footer>
  );
}