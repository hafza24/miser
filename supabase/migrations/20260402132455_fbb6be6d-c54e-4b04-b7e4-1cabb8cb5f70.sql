
-- Create site_pages table for admin-editable content
CREATE TABLE public.site_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;

-- Anyone (even unauthenticated) can read pages
CREATE POLICY "Anyone can view pages"
ON public.site_pages FOR SELECT TO anon, authenticated
USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "Admins can insert pages"
ON public.site_pages FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update pages"
ON public.site_pages FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete pages"
ON public.site_pages FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Seed default pages
INSERT INTO public.site_pages (slug, title, content) VALUES
('terms', 'Terms and Conditions', '# Terms and Conditions

Welcome to Fur&Fir. By using our platform, you agree to these terms.

## 1. Acceptance of Terms
By accessing or using Fur&Fir, you agree to be bound by these Terms and Conditions.

## 2. User Conduct
- You must be at least 18 years old to use this platform
- You agree not to harass, abuse, or harm other users
- You agree to respect the privacy and anonymity of others

## 3. Privacy
Your privacy is important to us. Please review our Privacy Policy for details on how we handle your data.

## 4. Content Guidelines
- No hate speech, discrimination, or illegal content
- Respect consent boundaries at all times
- Report violations through our support system

## 5. Account Termination
We reserve the right to suspend or terminate accounts that violate these terms.

## 6. Disclaimer
Fur&Fir is provided "as is" without warranties of any kind.

*Last updated: April 2026*'),

('privacy', 'Privacy Policy', '# Privacy Policy

Your privacy matters to us at Fur&Fir.

## 1. Information We Collect
- Account information (email, alias)
- Usage data and preferences
- Chat metadata (not content)

## 2. How We Use Your Data
- To provide and improve our services
- To ensure platform safety
- To communicate important updates

## 3. Data Protection
- All chats are private and encrypted
- We do not sell your personal data
- Minimal data collection policy

## 4. Your Rights
- Access your personal data
- Request data deletion
- Opt out of non-essential communications

## 5. Cookies
We use minimal cookies required for authentication and preferences only.

## 6. Contact
For privacy concerns, contact us at info@busistree.com

*Last updated: April 2026*'),

('faq', 'Frequently Asked Questions', '# FAQ

## General

**What is Fur&Fir?**
Fur&Fir is a privacy-first anonymous platform for emotional and romantic connection with two modes — Light and Dark.

**Is Fur&Fir free?**
Yes! Basic features are free. Premium subscriptions unlock additional features like dark mode and higher limits.

**How do I stay anonymous?**
You are assigned a random alias and emoji avatar. No real names or photos are required.

## Chats

**How do chat timers work?**
Chats have an expiration timer. Both participants can agree to stop the timer and keep the chat permanently.

**Can I block someone?**
Yes, you can block any user from their profile or within a chat.

**What is Light Mode vs Dark Mode?**
Light Mode is for emotional support and friendship. Dark Mode (18+) is for consensual flirting and romantic fantasy.

## Account

**How do I delete my account?**
Go to Settings and select "Delete Account". Your data will be permanently removed.

**I forgot my password**
Use the "Forgot Password" link on the login page to reset it.

## Safety

**How do you keep users safe?**
We use content moderation, user reporting, and a violation system to maintain a safe environment.

**How do I report someone?**
Use the report button in any chat or on a user''s profile.'),

('contact', 'Contact Us', '# Contact Us

We''d love to hear from you!

## Busistree Company

📞 **Phone:** +92 337 042 8337

📧 **Email:** info@busistree.com

💬 **In-App Support:** Use the help widget (?) at the bottom of any page to submit a support ticket.

## Response Times
- Support tickets: Within 24 hours
- Email inquiries: Within 48 hours
- Phone: Business hours (Mon-Fri, 9AM-6PM PKT)'),

('about', 'About Us', '# About Fur&Fir

## Our Mission
Fur&Fir is built on the belief that everyone deserves meaningful connection — whether it''s emotional support, friendship, or romantic exploration — in a safe and anonymous environment.

## One Brand. Two Modes. Your Choice.

🌞 **Light Mode** — A warm space for emotional support, friendship, and soft romance.

🌑 **Dark Mode** — An 18+ space for consensual flirting and romantic fantasy.

## Our Values
- **Privacy First** — Anonymous identity, minimal data collection
- **Consent Always** — Every interaction is consensual
- **Safety** — Active moderation and user protection
- **Inclusivity** — A welcoming space for everyone

## The Team
Fur&Fir is developed by **Busistree Company**, dedicated to building meaningful digital experiences.

📧 info@busistree.com');
