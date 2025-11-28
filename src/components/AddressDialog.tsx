import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';

// Governorates and their areas data
const governoratesData: Record<string, string[]> = {
  'بغداد': ['الكرخ', 'الرصافة', 'الكاظمية', 'الأعظمية', 'المنصور'],
  'البصرة': ['العشار', 'الزبير', 'أبو الخصيب', 'شط العرب', 'الفاو'],
  'نينوى': ['الموصل', 'تلعفر', 'سنجار', 'الحمدانية', 'بعشيقة'],
  'أربيل': ['مركز أربيل', 'عنكاوا', 'شقلاوة', 'سوران', 'كويسنجق'],
  'النجف': ['مركز النجف', 'الكوفة', 'المناذرة', 'الحيرة', 'المشخاب'],
  'كربلاء': ['مركز كربلاء', 'الهندية', 'عين التمر', 'الحر', 'الحسينية'],
  'ذي قار': ['الناصرية', 'الشطرة', 'الرفاعي', 'سوق الشيوخ', 'الجبايش'],
};

const governorates = Object.keys(governoratesData);

const addressSchema = z.object({
  full_name: z.string().min(1, 'الاسم مطلوب').max(100, 'الاسم طويل جداً'),
  phone_number: z.string().min(1, 'رقم الهاتف مطلوب').max(20, 'رقم الهاتف غير صحيح'),
  governorate: z.string().min(1, 'المحافظة مطلوبة'),
  area: z.string().min(1, 'المنطقة مطلوبة'),
  nearest_landmark: z.string().min(1, 'أقرب نقطة دالة مطلوبة'),
  additional_notes: z.string().optional(),
  is_default: z.boolean().default(false),
});

type AddressFormData = z.infer<typeof addressSchema>;

interface AddressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address?: any;
}

const AddressDialog = ({ open, onOpenChange, address }: AddressDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      full_name: '',
      phone_number: '',
      governorate: '',
      area: '',
      nearest_landmark: '',
      additional_notes: '',
      is_default: false,
    },
  });

  useEffect(() => {
    if (address) {
      form.reset({
        full_name: address.full_name || '',
        phone_number: address.phone_number || '',
        governorate: address.governorate || '',
        area: address.area || '',
        nearest_landmark: address.nearest_landmark || '',
        additional_notes: address.additional_notes || '',
        is_default: address.is_default || false,
      });
    } else {
      form.reset({
        full_name: '',
        phone_number: '',
        governorate: '',
        area: '',
        nearest_landmark: '',
        additional_notes: '',
        is_default: false,
      });
    }
  }, [address, form]);

  const mutation = useMutation({
    mutationFn: async (data: AddressFormData) => {
      if (!user?.id) throw new Error('User not authenticated');

      if (address) {
        // Update existing address
        const { error } = await supabase
          .from('user_addresses')
          .update({
            full_name: data.full_name,
            phone_number: data.phone_number,
            governorate: data.governorate,
            area: data.area,
            nearest_landmark: data.nearest_landmark,
            additional_notes: data.additional_notes,
            is_default: data.is_default,
          })
          .eq('id', address.id);

        if (error) throw error;
      } else {
        // Create new address
        const { error } = await supabase
          .from('user_addresses')
          .insert({
            user_id: user.id,
            full_name: data.full_name,
            phone_number: data.phone_number,
            governorate: data.governorate,
            area: data.area,
            nearest_landmark: data.nearest_landmark,
            additional_notes: data.additional_notes,
            is_default: data.is_default,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-addresses'] });
      toast({
        title: address ? "تم التحديث" : "تم الإضافة",
        description: address ? "تم تحديث العنوان بنجاح" : "تم إضافة العنوان بنجاح",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error saving address:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حفظ العنوان",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AddressFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {address ? 'تعديل العنوان' : 'إضافة عنوان جديد'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الاسم الكامل</FormLabel>
                  <FormControl>
                    <Input placeholder="محمد أحمد" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>رقم الهاتف</FormLabel>
                  <FormControl>
                    <Input placeholder="07XXXXXXXXX" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="governorate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>المحافظة</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      // Reset area when governorate changes
                      form.setValue('area', '');
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر المحافظة" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-background">
                      {governorates.map((gov) => (
                        <SelectItem key={gov} value={gov}>
                          {gov}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="area"
              render={({ field }) => {
                const selectedGovernorate = form.watch('governorate');
                const areas = selectedGovernorate ? governoratesData[selectedGovernorate] || [] : [];
                
                return (
                  <FormItem>
                    <FormLabel>المنطقة</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!selectedGovernorate}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={selectedGovernorate ? "اختر المنطقة" : "اختر المحافظة أولاً"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background">
                        {areas.map((area) => (
                          <SelectItem key={area} value={area}>
                            {area}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="nearest_landmark"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>أقرب نقطة دالة</FormLabel>
                  <FormControl>
                    <Input placeholder="قرب مول المنصور" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="additional_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ملاحظات أخرى (اختياري)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="أي تفاصيل إضافية تساعد في الوصول إلى العنوان"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_default"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none mr-2">
                    <FormLabel>
                      تعيين كعنوان افتراضي
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                disabled={mutation.isPending}
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  address ? 'تحديث' : 'إضافة'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default AddressDialog;
