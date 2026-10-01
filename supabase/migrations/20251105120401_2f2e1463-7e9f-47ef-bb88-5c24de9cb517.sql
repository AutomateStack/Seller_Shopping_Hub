-- Drop the overly permissive policy that allows anyone to view roles
DROP POLICY IF EXISTS "Anyone can view roles" ON public.user_roles;

-- Create restricted policy: authenticated users can only view their own role
CREATE POLICY "Users can view own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create policy: admins can view all roles for management purposes
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));