import * as React from 'react';
import { useForm } from 'react-hook-form';
import { cn } from '@/lib/utils';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useEffect } from 'react';

// Governorates and their areas data - All 18 Iraqi governorates
const governoratesData: Record<string, string[]> = {
  'بغداد': [
    'الكرخ', 'الرصافة', 'الكاظمية', 'الأعظمية', 'المنصور', 'الكرادة', 
    'المأمون', 'الشعب', 'مدينة الصدر', 'الدورة', 'الغزالية', 'اليرموك',
    'حي الجامعة', 'زيونة', 'البياع', 'العامرية', 'الجادرية', 'الحرية'
  ],
  'البصرة': [
    'العشار', 'الزبير', 'أبو الخصيب', 'شط العرب', 'الفاو', 'القرنة',
    'المدينة', 'الجبيلة', 'الهارثة', 'التنومة', 'البراضعية', 'الجزائر'
  ],
  'نينوى': [
    'الموصل', 'تلعفر', 'سنجار', 'الحمدانية', 'بعشيقة', 'الشيخان',
    'تلكيف', 'الحضر', 'البعاج', 'القيارة', 'مخمور', 'ربيعة'
  ],
  'أربيل': [
    'مركز أربيل', 'عنكاوا', 'شقلاوة', 'سوران', 'كويسنجق', 'خبات',
    'ديانا', 'راوندوز', 'حرير', 'صلاح الدين', 'بارزان'
  ],
  'النجف': [
    'مركز النجف', 'الكوفة', 'المناذرة', 'الحيرة', 'المشخاب', 'الحنانة',
    'السهلة', 'بحر النجف', 'الشبكة', 'الكندي'
  ],
  'كربلاء': [
    'مركز كربلاء', 'الهندية', 'عين التمر', 'الحر', 'الحسينية', 
    'الرزازة', 'طويريج', 'الجدول الغربي', 'الخيرات'
  ],
  'ذي قار': [
    'الناصرية', 'الشطرة', 'الرفاعي', 'سوق الشيوخ', 'الجبايش',
    'الفهود', 'الغراف', 'الدواية', 'البطحاء', 'الطار', 'قلعة سكر'
  ],
  'بابل': [
    'الحلة', 'المحاويل', 'المسيب', 'الهاشمية', 'القاسم', 'الكفل',
    'أبو غرق', 'الشوملي', 'الإسكندرية', 'جرف الصخر', 'المدحتية'
  ],
  'ديالى': [
    'بعقوبة', 'المقدادية', 'خانقين', 'بلدروز', 'الخالص', 'كفري',
    'المنصورية', 'قزانية', 'جلولاء', 'السعدية', 'أبو صيدا'
  ],
  'الأنبار': [
    'الرمادي', 'الفلوجة', 'هيت', 'حديثة', 'عنة', 'راوة', 'القائم',
    'الرطبة', 'الحبانية', 'الكرمة', 'عامرية الفلوجة', 'الخالدية'
  ],
  'واسط': [
    'الكوت', 'النعمانية', 'الحي', 'بدرة', 'الصويرة', 'العزيزية',
    'الزبيدية', 'جصان', 'شيخ سعد', 'الموفقية', 'الأحرار'
  ],
  'صلاح الدين': [
    'تكريت', 'سامراء', 'بيجي', 'الدور', 'بلد', 'الشرقاط',
    'الطوز', 'آمرلي', 'الضلوعية', 'الإسحاقي', 'العلم', 'يثرب'
  ],
  'كركوك': [
    'مركز كركوك', 'الحويجة', 'داقوق', 'دبس', 'الرياض', 'الملتقى',
    'ليلان', 'تازة', 'قره هنجير', 'ألتون كوبري'
  ],
  'المثنى': [
    'السماوة', 'الرميثة', 'الخضر', 'الوركاء', 'السلمان', 'المجد',
    'النجمي', 'الدراجي', 'البصية', 'آل غزي'
  ],
  'القادسية': [
    'الديوانية', 'عفك', 'الشامية', 'الحمزة', 'السنية', 'الدغارة',
    'الصلاحية', 'نفر', 'آل بدير', 'الشافعية', 'سومر'
  ],
  'ميسان': [
    'العمارة', 'علي الغربي', 'المجر الكبير', 'قلعة صالح', 'الميمونة',
    'الكحلاء', 'المشرح', 'العدل', 'الخير', 'سيد أحمد الرفاعي'
  ],
  'دهوك': [
    'مركز دهوك', 'زاخو', 'عقرة', 'العمادية', 'سميل', 'بردرش',
    'شيخان', 'ناحية كاني ماسي', 'سرسنك', 'باتيفا'
  ],
  'السليمانية': [
    'مركز السليمانية', 'حلبجة', 'رانية', 'دوكان', 'قرداغ', 'شارباژير',
    'بنجوين', 'كلار', 'دربنديخان', 'سيد صادق', 'خورمال', 'بازيان'
  ],
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
                const [areaOpen, setAreaOpen] = React.useState(false);
                
                return (
                  <FormItem className="flex flex-col">
                    <FormLabel>المنطقة</FormLabel>
                    <Popover open={areaOpen} onOpenChange={setAreaOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={areaOpen}
                            disabled={!selectedGovernorate}
                            className={cn(
                              "w-full justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value || (selectedGovernorate ? "اختر المنطقة" : "اختر المحافظة أولاً")}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0 bg-background" align="start">
                        <Command>
                          <CommandInput placeholder="ابحث عن منطقة..." className="text-right" dir="rtl" />
                          <CommandList>
                            <CommandEmpty>لا توجد نتائج</CommandEmpty>
                            <CommandGroup>
                              {areas.map((area) => (
                                <CommandItem
                                  key={area}
                                  value={area}
                                  onSelect={() => {
                                    field.onChange(area);
                                    setAreaOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "ml-2 h-4 w-4",
                                      field.value === area ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {area}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
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
