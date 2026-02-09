export type Lang = 'th' | 'en';

interface Labels {
  // App
  appName: string;
  appSubtitle: string;
  startNew: string;
  resumePrevious: string;
  connecting: string;
  transcript: string;
  messages: string;
  listening: string;
  reconnecting: string;
  connectionLost: string;
  reconnect: string;
  endSession: string;

  // Steps
  stepPhoto: string;
  stepPersonal: string;
  stepIncident: string;
  stepReceipt: string;

  // Photo capture
  takePhoto: string;
  takePhotoDesc: string;
  skip: string;
  retake: string;
  usePhoto: string;
  cameraUnavailable: string;
  cameraUnavailableDesc: string;

  // Form
  confirmed: string;
  fieldsConfirmed: string;
  allConfirmed: string;
  completed: string;
  edit: string;
  confirm: string;
  save: string;
  waitingForResponse: string;

  // Status badges
  statusWaiting: string;
  statusHeard: string;
  statusFromPhoto: string;
  statusConfirmed: string;

  // Field labels
  fullName: string;
  dateOfBirth: string;
  age: string;
  gender: string;
  nationality: string;
  phone: string;
  address: string;
  incidentType: string;
  incidentDescription: string;
  incidentDate: string;
  incidentLocation: string;
  incidentVictims: string;
  incidentSuspects: string;
  incidentEvidence: string;

  // Receipt
  intakeComplete: string;
  intakeCompleteDesc: string;
  referenceCode: string;
  printReceipt: string;
  nextCustomer: string;
  printPreview: string;
  printingIn: string;
  seconds: string;
  cancel: string;

  // End call
  endCallTitle: string;
  endCallDesc: string;

  // Language
  selectLanguage: string;
  thai: string;
  english: string;
}

const th: Labels = {
  appName: 'รักษา AI',
  appSubtitle: 'ผู้ช่วยรับแจ้งความ สถานีตำรวจ',
  startNew: 'เริ่มใหม่',
  resumePrevious: 'ดำเนินการต่อ',
  connecting: 'กำลังเชื่อมต่อ...',
  transcript: 'บทสนทนา',
  messages: 'ข้อความ',
  listening: 'กำลังฟัง...',
  reconnecting: 'กำลังเชื่อมต่อใหม่...',
  connectionLost: 'การเชื่อมต่อขาด ข้อมูลถูกบันทึกแล้ว',
  reconnect: 'เชื่อมต่อใหม่',
  endSession: 'สิ้นสุด',

  stepPhoto: 'ถ่ายรูป',
  stepPersonal: 'ข้อมูลส่วนตัว',
  stepIncident: 'รายละเอียดเหตุการณ์',
  stepReceipt: 'ใบรับแจ้ง',

  takePhoto: 'ถ่ายรูป',
  takePhotoDesc: 'เพื่อยืนยันตัวตนและกรอกข้อมูลเบื้องต้น',
  skip: 'ข้าม',
  retake: 'ถ่ายใหม่',
  usePhoto: 'ใช้รูปนี้',
  cameraUnavailable: 'กล้องไม่พร้อมใช้งาน',
  cameraUnavailableDesc: 'กรุณาอนุญาตการเข้าถึงกล้อง หรือข้ามขั้นตอนนี้',

  confirmed: 'ยืนยันแล้ว',
  fieldsConfirmed: 'ช่อง ยืนยันแล้ว',
  allConfirmed: 'ยืนยันทุกช่องแล้ว',
  completed: 'เสร็จสิ้น',
  edit: 'แก้ไข',
  confirm: 'ยืนยัน',
  save: 'บันทึก',
  waitingForResponse: 'รอคำตอบ...',

  statusWaiting: 'รอ',
  statusHeard: 'จากคำพูด',
  statusFromPhoto: 'จากรูป',
  statusConfirmed: 'ยืนยัน',

  fullName: 'ชื่อ-นามสกุล',
  dateOfBirth: 'วันเกิด',
  age: 'อายุ',
  gender: 'เพศ',
  nationality: 'สัญชาติ',
  phone: 'หมายเลขโทรศัพท์',
  address: 'ที่อยู่',
  incidentType: 'ประเภทเหตุการณ์',
  incidentDescription: 'รายละเอียด',
  incidentDate: 'วันเวลาเกิดเหตุ',
  incidentLocation: 'สถานที่',
  incidentVictims: 'ผู้เสียหาย',
  incidentSuspects: 'ลักษณะผู้ต้องสงสัย',
  incidentEvidence: 'หลักฐาน / หมายเหตุ',

  intakeComplete: 'รับแจ้งเสร็จสิ้น',
  intakeCompleteDesc: 'ยืนยันข้อมูลครบทุกช่องแล้ว',
  referenceCode: 'รหัสอ้างอิง',
  printReceipt: 'พิมพ์ใบรับแจ้ง',
  nextCustomer: 'รายต่อไป',
  printPreview: 'ตัวอย่างก่อนพิมพ์',
  printingIn: 'พิมพ์ใน',
  seconds: 'วินาที',
  cancel: 'ยกเลิก',

  endCallTitle: 'ต้องการวางสายหรือไม่?',
  endCallDesc: 'ข้อมูลที่กรอกแล้วจะถูกบันทึกไว้',

  selectLanguage: 'เลือกภาษา',
  thai: 'ไทย',
  english: 'English',
};

const en: Labels = {
  appName: 'Raksa AI',
  appSubtitle: 'Police Station Intake Assistant',
  startNew: 'Start New',
  resumePrevious: 'Resume Previous',
  connecting: 'Connecting...',
  transcript: 'Transcript',
  messages: 'messages',
  listening: 'Listening...',
  reconnecting: 'Reconnecting...',
  connectionLost: 'Connection lost. Progress saved.',
  reconnect: 'Reconnect',
  endSession: 'End',

  stepPhoto: 'Photo ID',
  stepPersonal: 'Personal Details',
  stepIncident: 'Incident Details',
  stepReceipt: 'Receipt',

  takePhoto: 'Take a Photo',
  takePhotoDesc: 'Helps identify you and pre-fill details.',
  skip: 'Skip',
  retake: 'Retake',
  usePhoto: 'Use Photo',
  cameraUnavailable: 'Camera Unavailable',
  cameraUnavailableDesc: 'Allow camera access or skip this step.',

  confirmed: 'confirmed',
  fieldsConfirmed: 'fields confirmed',
  allConfirmed: 'All fields confirmed.',
  completed: 'Completed',
  edit: 'Edit',
  confirm: 'Confirm',
  save: 'Save',
  waitingForResponse: 'Waiting for response...',

  statusWaiting: 'Waiting',
  statusHeard: 'From Speech',
  statusFromPhoto: 'From Photo',
  statusConfirmed: 'Confirmed',

  fullName: 'Full Name',
  dateOfBirth: 'Date of Birth',
  age: 'Age',
  gender: 'Gender',
  nationality: 'Nationality',
  phone: 'Phone Number',
  address: 'Address',
  incidentType: 'Type of Incident',
  incidentDescription: 'What Happened',
  incidentDate: 'When It Happened',
  incidentLocation: 'Location',
  incidentVictims: 'Who Was Affected',
  incidentSuspects: 'Suspect Description',
  incidentEvidence: 'Evidence / Notes',

  intakeComplete: 'Intake Complete',
  intakeCompleteDesc: 'All fields have been confirmed.',
  referenceCode: 'Reference Code',
  printReceipt: 'Print Receipt',
  nextCustomer: 'Next Customer',
  printPreview: 'Print Preview',
  printingIn: 'Printing in',
  seconds: 's',
  cancel: 'Cancel',

  endCallTitle: 'End this call?',
  endCallDesc: 'Your progress has been saved.',

  selectLanguage: 'Select Language',
  thai: 'ไทย',
  english: 'English',
};

const strings: Record<Lang, Labels> = { th, en };

export function t(lang: Lang): Labels {
  return strings[lang];
}

/** Get both Thai and English labels for a key */
export function dual(key: keyof Labels): { th: string; en: string } {
  return { th: strings.th[key], en: strings.en[key] };
}

/** Field ID → label key mapping */
export const fieldLabelKey: Record<string, keyof Labels> = {
  full_name: 'fullName',
  date_of_birth: 'dateOfBirth',
  age: 'age',
  gender: 'gender',
  nationality: 'nationality',
  phone: 'phone',
  address: 'address',
  incident_type: 'incidentType',
  incident_description: 'incidentDescription',
  incident_date: 'incidentDate',
  incident_location: 'incidentLocation',
  incident_victims: 'incidentVictims',
  incident_suspects: 'incidentSuspects',
  incident_evidence: 'incidentEvidence',
};
