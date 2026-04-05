
-- Add alias change tracking
ALTER TABLE public.profiles ADD COLUMN alias_changed_at timestamp with time zone DEFAULT NULL;

-- Add reply_to for message replies
ALTER TABLE public.messages ADD COLUMN reply_to uuid REFERENCES public.messages(id) DEFAULT NULL;

-- Create admin-editable payment info table
CREATE TABLE public.payment_info (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  method_name text NOT NULL,
  account_number text NOT NULL,
  account_holder text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active payment info"
ON public.payment_info FOR SELECT TO authenticated
USING (is_active = true);

CREATE POLICY "Admins can manage payment info"
ON public.payment_info FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_payment_info_updated_at
BEFORE UPDATE ON public.payment_info
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
