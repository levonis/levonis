-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT NOT NULL,
  description TEXT,
  description_ar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories"
  ON public.categories FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage categories"
  ON public.categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  description_ar TEXT,
  price DECIMAL(10, 2) NOT NULL,
  original_price DECIMAL(10, 2),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  image_url TEXT,
  in_stock BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view products"
  ON public.products FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage products"
  ON public.products FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  
  -- Add default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Insert sample categories
INSERT INTO public.categories (name, name_ar, slug, icon, description, description_ar) VALUES
  ('Graphics Cards', 'كروت الشاشة', 'graphics-cards', 'GPU', 'NVIDIA / AMD', 'أنفيديا / AMD'),
  ('Processors', 'المعالجات', 'processors', 'CPU', 'Intel / AMD', 'Intel / AMD'),
  ('Motherboards', 'اللوحة الأم', 'motherboards', 'MB', 'Z790 / B650', 'Z790 / B650'),
  ('Power Supplies', 'الباور', 'power-supplies', 'PSU', '80+ Gold/Platinum', '80+ Gold/Platinum'),
  ('Storage', 'التخزين', 'storage', 'SSD', 'NVMe Gen4/5', 'NVMe Gen4/5'),
  ('Cooling', 'المراوح والتبريد', 'cooling', 'FAN', 'AIO / Air', 'AIO / Air');

-- Insert sample products
INSERT INTO public.products (name, name_ar, slug, description, description_ar, price, original_price, category_id, image_url, featured) VALUES
  ('RTX 4080 16GB', 'RTX 4080 16GB', 'rtx-4080-16gb', 'Triple Cooling · DLSS3', 'تبريد ثلاثي · DLSS3', 5299.00, 5999.00, (SELECT id FROM categories WHERE slug = 'graphics-cards'), 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=600&q=80', true),
  ('Intel Core i9‑13900K', 'Intel Core i9‑13900K', 'intel-i9-13900k', '24 Hybrid Cores', '24 نواة هجينة', 2499.00, 2799.00, (SELECT id FROM categories WHERE slug = 'processors'), 'https://images.unsplash.com/photo-1555680202-c352f4ab02a4?w=600&q=80', true),
  ('ROG Strix Z790', 'ROG Strix Z790', 'rog-strix-z790', 'PCIe 5.0 · DDR5', 'PCIe 5.0 · DDR5', 1899.00, 2099.00, (SELECT id FROM categories WHERE slug = 'motherboards'), 'https://images.unsplash.com/photo-1587202372616-b43abea06c2a?w=600&q=80', true),
  ('Samsung 980 PRO 2TB', 'Samsung 980 PRO 2TB', 'samsung-980-pro-2tb', '7GB/s Speed', 'سرعة 7GB/s', 899.00, 950.00, (SELECT id FROM categories WHERE slug = 'storage'), 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=600&q=80', true),
  ('Corsair 850W', 'Corsair 850W', 'corsair-850w', '80+ Gold', '80+ Gold', 749.00, 799.00, (SELECT id FROM categories WHERE slug = 'power-supplies'), 'https://images.unsplash.com/photo-1609956123193-23e9ca159c03?w=600&q=80', true),
  ('NZXT Kraken X73', 'NZXT Kraken X73', 'nzxt-kraken-x73', '360mm AIO', '360mm AIO', 899.00, 999.00, (SELECT id FROM categories WHERE slug = 'cooling'), 'https://images.unsplash.com/photo-1587202372583-49330a15584d?w=600&q=80', true);