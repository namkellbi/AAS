export type KeywordAudiencePreset = {
  id: string;
  label: { en: string; vi: string };
  description: { en: string; vi: string };
  seed: string;
};

export const keywordAudiencePresets: KeywordAudiencePreset[] = [
  {
    id: 'office_women',
    label: { en: 'Office women', vi: 'Nữ văn phòng' },
    description: { en: 'Clothing, desk comfort, makeup and daily commute.', vi: 'Trang phục, bàn làm việc, makeup và đi lại hằng ngày.' },
    seed: 'nữ văn phòng, dress code, ngồi làm việc lâu, makeup đi làm, đồ dùng bàn làm việc'
  },
  {
    id: 'students',
    label: { en: 'Students', vi: 'Sinh viên' },
    description: { en: 'Dorm rooms, study, commuting and affordable essentials.', vi: 'Phòng trọ, học tập, đi lại và đồ dùng giá dễ mua.' },
    seed: 'sinh viên, phòng trọ, học bài, đi xe buýt, đồ dùng tiết kiệm'
  },
  {
    id: 'glasses',
    label: { en: 'Glasses wearers', vi: 'Người đeo kính' },
    description: { en: 'Slipping, fogging, loose frames and daily discomfort.', vi: 'Kính tụt, mờ kính, gọng lỏng và bất tiện hằng ngày.' },
    seed: 'người đeo kính, kính tụt, kính mờ, gọng lỏng, đau tai khi đeo kính'
  },
  {
    id: 'oily_skin',
    label: { en: 'Oily skin', vi: 'Người có da dầu' },
    description: { en: 'Makeup longevity and practical skincare routines.', vi: 'Giữ makeup và routine chăm sóc da thực tế.' },
    seed: 'da dầu, makeup trôi, mặt bóng dầu, kem chống nắng cho da dầu'
  },
  {
    id: 'small_spaces',
    label: { en: 'Small-space renters', vi: 'Người ở phòng trọ nhỏ' },
    description: { en: 'Storage, cleaning and compact household products.', vi: 'Lưu trữ, dọn dẹp và đồ gia dụng nhỏ gọn.' },
    seed: 'phòng trọ nhỏ, thiếu chỗ để đồ, dọn phòng, đồ gia dụng nhỏ gọn'
  },
  {
    id: 'sleep_comfort',
    label: { en: 'Sleep comfort', vi: 'Người khó ngủ thoải mái' },
    description: { en: 'Light, noise, heat and bedroom comfort.', vi: 'Ánh sáng, tiếng ồn, nóng và độ thoải mái phòng ngủ.' },
    seed: 'khó ngủ vì sáng, phòng nóng, tiếng ồn, gối nằm không thoải mái'
  },
  {
    id: 'active_people',
    label: { en: 'Active people', vi: 'Người hay vận động' },
    description: { en: 'Sweat, carrying essentials and workout convenience.', vi: 'Mồ hôi, mang đồ và sự tiện lợi khi vận động.' },
    seed: 'hay vận động, đổ mồ hôi, mang đồ tập, chạy bộ, tập gym'
  },
  {
    id: 'young_moms',
    label: { en: 'Young moms', vi: 'Mẹ có con nhỏ' },
    description: { en: 'Organization, feeding and everyday convenience.', vi: 'Sắp xếp đồ, ăn uống và tiện lợi khi chăm con.' },
    seed: 'mẹ có con nhỏ, đồ dùng chăm bé, sắp xếp đồ cho bé, ra ngoài cùng em bé'
  }
];
