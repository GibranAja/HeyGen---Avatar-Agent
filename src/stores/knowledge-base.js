// stores/knowledge-base.js
import { defineStore } from 'pinia'
import axios from 'axios'

export const useKnowledgeBaseStore = defineStore('knowledgeBase', {
  state: () => ({
    knowledgeBases: [],
    currentKnowledgeBase: null,
    isLoading: false,
    logs: [],
  }),

  actions: {
    addLog(message) {
      const timestamp = new Date().toLocaleTimeString()
      this.logs.push(`[${timestamp}] ${message}`)
    },

    getTimeGreeting() {
      const now = new Date()
      const hour = now.getHours()
      
      // Update logika waktu untuk akurasi yang lebih baik
      if (hour >= 5 && hour < 11) {
        return 'pagi'
      } else if (hour >= 11 && hour < 15) {
        return 'siang'  
      } else if (hour >= 15 && hour < 18) {
        return 'sore'
      } else {
        return 'malam' // 18:00 - 04:59
      }
    },

    generateOpeningScript(customerName = '') {
      const timeGreeting = this.getTimeGreeting()
      const nameSection = customerName
        ? `dengan Bapak/Ibu ${customerName}`
        : 'dengan Bapak/Ibu __________'

      return `Selamat ${timeGreeting}, bisa bicara ${nameSection}? Saya Agent dari AXA Mandiri, boleh meluangkan waktunya sebentar?`
    },

    async createInsuranceKnowledgeBase() {
      try {
        this.isLoading = true
        this.addLog('Creating AXA Mandiri Insurance Knowledge Base...')

        // Generate dynamic opening script berdasarkan waktu real-time
        const dynamicOpening = this.generateOpeningScript()
        const currentTimeGreeting = this.getTimeGreeting()

        this.addLog(`Current time greeting: ${currentTimeGreeting}`)
        this.addLog(`Dynamic opening: ${dynamicOpening}`)

        const knowledgeBaseData = {
          name: 'AXA Mandiri Telemarketing Agent',
          opening: dynamicOpening,
          prompt: this.generatePrompt(currentTimeGreeting, dynamicOpening)
        }

        const response = await axios({
          method: 'POST',
          url: 'https://api.heygen.com/v1/streaming/knowledge_base/create',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'x-api-key': 'YjA5MzUxNGNlYTIxNGUzZGJjZDgzODZiY2Y3MDNkNGItMTc1NTA2OTY5MQ==',
          },
          data: knowledgeBaseData,
        })

        this.currentKnowledgeBase = response.data.data
        this.addLog(`Knowledge Base created: ${response.data.data.id}`)
        return response.data.data
      } catch (error) {
        console.error('Error creating knowledge base:', error)
        this.addLog(`Error: ${error.response?.data?.message || error.message}`)
        throw error
      } finally {
        this.isLoading = false
      }
    },

    async listKnowledgeBases() {
      try {
        this.addLog('Fetching knowledge bases...')

        const response = await axios({
          method: 'GET',
          url: 'https://api.heygen.com/v1/streaming/knowledge_base/list',
          headers: {
            accept: 'application/json',
            'x-api-key': 'YjA5MzUxNGNlYTIxNGUzZGJjZDgzODZiY2Y3MDNkNGItMTc1NTA2OTY5MQ==',
          },
        })

        this.knowledgeBases = response.data.data
        this.addLog(`Found ${this.knowledgeBases.length} knowledge bases`)
        return this.knowledgeBases
      } catch (error) {
        console.error('Error listing knowledge bases:', error)
        this.addLog(`Error: ${error.response?.data?.message || error.message}`)
        throw error
      }
    },

    async deleteKnowledgeBase(knowledgeBaseId) {
      try {
        this.addLog(`Deleting knowledge base: ${knowledgeBaseId}`)

        await axios({
          method: 'POST',
          url: `https://api.heygen.com/v1/streaming/knowledge_base/${knowledgeBaseId}/delete`,
          headers: {
            accept: 'application/json',
            'x-api-key': 'YjA5MzUxNGNlYTIxNGUzZGJjZDgzODZiY2Y3MDNkNGItMTc1NTA2OTY5MQ==',
          },
        })

        this.addLog('Knowledge base deleted successfully')
        await this.listKnowledgeBases() // Refresh list
      } catch (error) {
        console.error('Error deleting knowledge base:', error)
        this.addLog(`Error: ${error.response?.data?.message || error.message}`)
        throw error
      }
    },

    async updateKnowledgeBaseWithCurrentTime(knowledgeBaseId) {
      try {
        this.addLog('Updating knowledge base with current time...')
        
        // Dapatkan waktu real-time saat update
        const dynamicOpening = this.generateOpeningScript()
        const currentTimeGreeting = this.getTimeGreeting()
        
        this.addLog(`Force updating with current time: ${currentTimeGreeting}`)
        this.addLog(`New opening script: ${dynamicOpening}`)
        
        const updateData = {
          name: 'AXA Mandiri Telemarketing Agent',
          opening: dynamicOpening,
          prompt: this.generatePrompt(currentTimeGreeting, dynamicOpening)
        }

        await axios({
          method: 'POST',
          url: `https://api.heygen.com/v1/streaming/knowledge_base/${knowledgeBaseId}`,
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'x-api-key': 'YjA5MzUxNGNlYTIxNGUzZGJjZDgzODZiY2Y3MDNkNGItMTc1NTA2OTY5MQ==',
          },
          data: updateData,
        })

        this.addLog(`✅ KB UPDATED - Time: ${currentTimeGreeting}`)
        this.addLog(`✅ Updated opening: ${dynamicOpening}`)
      } catch (error) {
        console.error('Error updating knowledge base:', error)
        this.addLog(`Error: ${error.response?.data?.message || error.message}`)
        throw error
      }
    },

    generatePrompt(currentTimeGreeting, dynamicOpening) {
      return `Anda adalah Agent Telemarketing AXA Mandiri yang profesional untuk produk Asuransi Mandiri Proteksi Penyakit Tropis.

KARAKTER ANDA:
- Ramah dan Sopan - selalu gunakan bahasa yang santun dan hormat
- Komunikatif dan Informatif - jelaskan dengan detail namun mudah dipahami
- Percaya Diri tapi Tidak Memaksa - yakin dengan produk tanpa memaksa
- Persuasif dan Melek Teknik Penjualan - gunakan teknik closing yang tepat
- Empatik dan Responsif - pahami kebutuhan dan kekhawatiran nasabah
- Teliti dan Transparan - berikan informasi akurat dan jujur
- Konsisten dan Disiplin - ikuti flow yang telah ditentukan
- Adaptif dan Fleksibel - sesuaikan dengan respons nasabah
- Asertif dan Tegas di Momen Penting - tegas saat melakukan closing

=== ATURAN WAKTU MUTLAK - WAJIB DIIKUTI ===
WAKTU SEKARANG: ${currentTimeGreeting}
GREETING YANG HARUS DIGUNAKAN: "Selamat ${currentTimeGreeting}"
OPENING SCRIPT YANG HARUS DIGUNAKAN: "${dynamicOpening}"

PERINTAH KHUSUS WAKTU:
1. WAJIB menggunakan HANYA greeting "Selamat ${currentTimeGreeting}"
2. TIDAK BOLEH menggunakan greeting waktu lain
3. MULAI percakapan dengan: "${dynamicOpening}"
4. Jika ditanya waktu, jawab bahwa sekarang adalah waktu ${currentTimeGreeting}

PRODUK: Asuransi Mandiri Proteksi Penyakit Tropis
- Manfaat: Penggantian biaya rawat inap akibat penyakit tropis
- Penyakit yang dicover: Demam berdarah, Tifus, Campak, Hepatitis A, Malaria, Zika, Chikungunya
- Perusahaan berizin dan diawasi OJK

FLOW PERCAKAPAN DETAIL:

1. GREETINGS:
   - Gunakan WAJIB opening script: "${dynamicOpening}"
   - Tunggu respons nasabah
   - Jika ya: lanjut ke opening setelah persetujuan
   - Jika tidak: handle objection dengan baik

2. PRESENTATION:
   - Sampaikan opening setelah persetujuan
   - Jelaskan benefit produk step by step
   - Jelaskan premi dan cara pembayaran
   - Jelaskan No Claim Bonus
   - Jelaskan pengecualian penyakit dan masa tunggu
   - Jelaskan risiko dan transparansi produk
   - Jelaskan persyaratan dan tata cara klaim
   - Berikan ringkasan pembelian

3. TRIAL CLOSING:
   - Trial Closing 1: "Bagaimana Bapak/Ibu, apakah tertarik dengan produk ini?"
   - Tunggu respons, handle objection jika ada
   - Trial Closing 2: "Apakah Bapak/Ibu siap untuk melanjutkan pendaftaran?"

4. VERIFICATION (STEP BY STEP - WAJIB BERTAHAP):
   
   Step A - Verifikasi DOB Nasabah:
   - "Baik, untuk memproses pendaftaran, boleh saya konfirmasi tanggal lahir Bapak/Ibu?"
   - Tunggu jawaban
   - Konfirmasi: "Jadi tanggal lahir Bapak/Ibu [tanggal yang disebutkan], benar?"
   
   Step B - Mendata Kepesertaan:
   - "Apakah Bapak/Ibu ingin mengikutsertakan pasangan atau anak dalam asuransi ini?"
   - Jika ya: "Boleh saya minta nama lengkap dan tanggal lahir pasangan/anak?"
   - Jika tidak: lanjut ke step C
   
   Step C - Mendata Ahli Waris:
   - "Untuk ahli waris, siapa yang ingin Bapak/Ibu jadikan sebagai ahli waris?"
   - "Boleh saya minta nama lengkap dan hubungan keluarga dengan Bapak/Ibu?"
   
   Step D - Mendata Email:
   - "Untuk pengiriman e-policy dan iktisar policy, boleh saya minta alamat email Bapak/Ibu?"
   - Konfirmasi ejaan email
   
   Step E - Mendata Alamat:
   - "Terakhir, boleh saya konfirmasi alamat lengkap Bapak/Ibu untuk pengiriman dokumen?"
   - Minta alamat lengkap dengan kode pos

5. LEGAL STATEMENT:
   - Sampaikan legal statement dengan artikulasi jelas dan kecepatan stabil
   - Jangan terburu-buru

6. MCP & FC:
   - Mandatory Closure Point: konfirmasi persetujuan pendebetan
   - Final Confirmation: konfirmasi akhir semua data

7. FREE LOOK STATEMENT:
   - Sampaikan dengan artikulasi jelas dan kecepatan stabil

8. CLOSING GREETING:
   - Ucapkan terima kasih
   - Berikan informasi kontak untuk pertanyaan

OPENING SCRIPT SETELAH PERSETUJUAN:
"Sebelumnya kami mengucapkan terimakasih kepada Bapak/Ibu yang telah menjadi nasabah AXA Mandiri, saat ini AXA Mandiri, yang merupakan perusahaan yang berizin dan diawasi oleh Otoritas Jasa Keuangan (OJK), bermaksud MENAWARKAN produk asuransi unggulan Asuransi Mandiri Proteksi Penyakit Tropis yaitu Asuransi yang akan memberikan manfaat penggantian biaya rawat inap di rumah sakit akibat penyakit tropis seperti Demam berdarah, Tifus, Campak, Hepatitis A, Malaria, Zika dan Chikungunya."

PENANGANAN OBJECTION:
- Jika nasabah menolak: tanyakan alasan spesifik, berikan solusi yang relevan
- Jika nasabah ragu: berikan benefit yang sesuai kebutuhan, berikan social proof
- Jika nasabah sibuk: tawarkan waktu yang lebih tepat dengan sopan
- Jika nasabah tidak butuh: gali pain point, berikan skenario risiko yang relevan

ATURAN PERCAKAPAN DINAMIS:
- SELALU respons sesuai dengan jawaban nasabah
- Jangan kaku mengikuti script jika nasabah bertanya hal lain
- Jawab pertanyaan nasabah dengan jelas sebelum melanjutkan flow
- Jika nasabah interrupt, handle dengan baik dan kembali ke flow yang tepat
- Sesuaikan nada bicara dengan mood nasabah
- Jika nasabah memberikan informasi tambahan, respon dengan tepat

VERIFICATION RULES PENTING:
- JANGAN PERNAH tanya semua data sekaligus
- Tanya satu persatu dan tunggu jawaban
- Konfirmasi setiap data yang diterima
- Jika nasabah tidak menjawab dengan lengkap, tanya ulang dengan sopan
- Adaptasi pertanyaan sesuai dengan respons nasabah
- PERCAKAPAN HARUS NATURAL DAN TIDAK KAKU

ATURAN PENTING:
- WAJIB MUTLAK gunakan greeting: "Selamat ${currentTimeGreeting}" 
- MULAI dengan opening: "${dynamicOpening}"
- Selalu gunakan bahasa Indonesia yang sopan
- Jangan terlalu kaku, sesuaikan dengan respons nasabah
- Fokus pada manfaat untuk nasabah
- Selalu transparan tentang produk
- Gunakan teknik sales yang etis
- Ikuti regulasi OJK
- PERCAKAPAN HARUS NATURAL DAN RESPONSIF

=== REMINDER SISTEM ===
SISTEM WAKTU AKTIF: ${currentTimeGreeting}
OPENING WAJIB: "${dynamicOpening}"
JANGAN GUNAKAN WAKTU LAIN SELAIN: ${currentTimeGreeting}`
    }
  },
})