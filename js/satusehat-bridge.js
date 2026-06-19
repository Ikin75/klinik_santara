// ============================================
// SATUSEHAT BRIDGE - JEMBATAN KE SATUSEHAT
// ============================================

export class SatusehatBridge {
  constructor() {
    // Alamat mock server (nanti ganti ke SATUSEHAT asli)
    this.baseURL = "http://localhost:3001";
    this.token = null;
  }

  /**
   * Dapatkan token akses
   */
  async getToken() {
    try {
      console.log("🔐 Mengambil token SATUSEHAT...");

      const response = await fetch(`${this.baseURL}/oauth2/v1/accesstoken`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "client_id=test&client_secret=test&grant_type=client_credentials",
      });

      if (!response.ok) {
        throw new Error(`Gagal dapat token: ${response.status}`);
      }

      const data = await response.json();
      this.token = data.access_token;

      console.log("✅ Token didapat");
      return this.token;
    } catch (error) {
      console.error("❌ Gagal dapat token:", error.message);
      throw error;
    }
  }

  /**
   * Daftarkan pasien ke SATUSEHAT
   * @param {Object} patientData - Data pasien dari database
   * @returns {Object} { success, ihsNumber, error }
   */
  async registerPatient(patientData) {
    try {
      // 1. Pastikan punya token
      if (!this.token) {
        await this.getToken();
      }

      console.log("👤 Mendaftarkan pasien ke SATUSEHAT...");
      console.log("   Nama:", patientData.full_name);
      console.log("   NIK:", patientData.nik);

      // 2. Format data sesuai FHIR
      const fhirData = {
        resourceType: "Patient",
        active: true,
        identifier: [
          {
            system: "https://fhir.kemkes.go.id/id/nik",
            value: patientData.nik || "",
            use: "official",
          },
        ],
        name: [
          {
            use: "official",
            text: patientData.full_name || "",
          },
        ],
        gender:
          patientData.gender === "Laki-laki"
            ? "male"
            : patientData.gender === "Perempuan"
              ? "female"
              : "unknown",
        birthDate: patientData.birth_date || null,
        telecom: [
          ...(patientData.phone
            ? [
                {
                  system: "phone",
                  value: patientData.phone,
                  use: "mobile",
                },
              ]
            : []),
          ...(patientData.email
            ? [
                {
                  system: "email",
                  value: patientData.email,
                  use: "home",
                },
              ]
            : []),
        ],
        address: patientData.address
          ? [
              {
                use: "home",
                line: [patientData.address],
                city: patientData.city || "",
                country: "ID",
              },
            ]
          : [],
      };

      // 3. Kirim ke SATUSEHAT
      const response = await fetch(`${this.baseURL}/fhir-r4/v1/Patient`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fhirData),
      });

      // 4. Handle response
      if (response.status === 401) {
        // Token expired, refresh & coba lagi
        console.log("🔄 Token expired, refresh...");
        await this.getToken();
        return this.registerPatient(patientData);
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(JSON.stringify(error));
      }

      const result = await response.json();

      console.log("✅ Pasien terdaftar di SATUSEHAT!");
      console.log("   IHS Number:", result.id);

      return {
        success: true,
        ihsNumber: result.id,
        message: "Berhasil terdaftar di SATUSEHAT",
      };
    } catch (error) {
      console.error("❌ Gagal daftar pasien:", error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Kirim data kunjungan
   */
  async sendEncounter(patientIHS, patientName, poli) {
    try {
      if (!this.token) await this.getToken();

      console.log("🏥 Mengirim kunjungan ke SATUSEHAT...");

      const fhirData = {
        resourceType: "Encounter",
        status: "planned",
        class: {
          system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
          code: "AMB",
          display: "ambulatory",
        },
        subject: {
          reference: `Patient/${patientIHS}`,
          display: patientName,
        },
        period: {
          start: new Date().toISOString(),
        },
        reasonCode: [
          {
            text: `Kunjungan ${poli || "Poli Umum"}`,
          },
        ],
        serviceProvider: {
          reference: "Organization/ORG-001",
        },
      };

      const response = await fetch(`${this.baseURL}/fhir-r4/v1/Encounter`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fhirData),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json();

      console.log("✅ Kunjungan terkirim!");
      console.log("   Encounter IHS:", result.id);

      return {
        success: true,
        encounterIHS: result.id,
      };
    } catch (error) {
      console.error("❌ Gagal kirim kunjungan:", error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Kirim data diagnosa (Condition) ke SATUSEHAT
   * @param {string} patientIHS - IHS Number pasien
   * @param {string} icd10Code - Kode ICD-10 (contoh: J00)
   * @param {string} icd10Name - Nama diagnosa (contoh: Acute nasopharyngitis)
   * @returns {Object} { success, conditionIHS, error }
   */
  async sendCondition(patientIHS, icd10Code, icd10Name, encounterIHS = null) {
    try {
      if (!this.token) await this.getToken();

      console.log("🏷️ Mengirim diagnosa ke SATUSEHAT...");
      console.log("   Kode ICD-10:", icd10Code);
      console.log("   Nama:", icd10Name);

      const fhirData = {
        resourceType: "Condition",
        clinicalStatus: {
          coding: [
            {
              system:
                "http://terminology.hl7.org/CodeSystem/condition-clinical",
              code: "active",
              display: "Active",
            },
          ],
        },
        verificationStatus: {
          coding: [
            {
              system:
                "http://terminology.hl7.org/CodeSystem/condition-ver-status",
              code: "confirmed",
              display: "Confirmed",
            },
          ],
        },
        category: [
          {
            coding: [
              {
                system:
                  "http://terminology.hl7.org/CodeSystem/condition-category",
                code: "encounter-diagnosis",
                display: "Encounter Diagnosis",
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: "http://hl7.org/fhir/sid/icd-10",
              code: icd10Code,
              display: icd10Name,
            },
          ],
          text: `${icd10Code} - ${icd10Name}`,
        },
        subject: {
          reference: `Patient/${patientIHS}`,
        },
        onsetDateTime: new Date().toISOString(),
      };

      // Tambahkan encounter reference jika ada
      if (encounterIHS) {
        fhirData.encounter = {
          reference: `Encounter/${encounterIHS}`,
        };
      }

      const response = await fetch(`${this.baseURL}/fhir-r4/v1/Condition`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fhirData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(JSON.stringify(error));
      }

      const result = await response.json();

      console.log("✅ Diagnosa terkirim!");
      console.log("   Condition IHS:", result.id);

      return {
        success: true,
        conditionIHS: result.id,
      };
    } catch (error) {
      console.error("❌ Gagal kirim diagnosa:", error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Kirim data resep obat (MedicationRequest) ke SATUSEHAT
   * @param {string} patientIHS - IHS Number pasien
   * @param {string} encounterIHS - IHS Number kunjungan
   * @param {Array} medications - Array obat [{ drug_name, dose, qty }]
   * @returns {Object} { success, medicationIHS, error }
   */
  async sendMedicationRequest(patientIHS, encounterIHS, medications) {
    try {
      if (!this.token) await this.getToken();

      console.log("💊 Mengirim resep ke SATUSEHAT...");
      console.log("   Jumlah obat:", medications.length);

      // Gabungkan nama obat untuk display
      const drugNames = medications
        .map((m) => `${m.drug_name} ${m.dose}`)
        .join(", ");
      const totalQty = medications.reduce((sum, m) => sum + (m.qty || 0), 0);

      // Buat dosage instruction untuk setiap obat
      const dosageInstruction = medications.map((med, index) => ({
        sequence: index + 1,
        text: `${med.drug_name} - ${med.dose}`,
        timing: {
          code: {
            text: med.dose || "1x1",
          },
        },
        doseAndRate: [
          {
            doseQuantity: {
              value: med.qty || 1,
              unit: "Tablet",
              system: "http://unitsofmeasure.org",
              code: "{tbl}",
            },
          },
        ],
      }));

      const fhirData = {
        resourceType: "MedicationRequest",
        status: "active",
        intent: "order",
        medicationCodeableConcept: {
          text: drugNames,
        },
        subject: {
          reference: `Patient/${patientIHS}`,
        },
        encounter: {
          reference: `Encounter/${encounterIHS}`,
        },
        authoredOn: new Date().toISOString(),
        dosageInstruction: dosageInstruction,
        dispenseRequest: {
          quantity: {
            value: totalQty,
            unit: "Tablet",
          },
        },
      };

      const response = await fetch(
        `${this.baseURL}/fhir-r4/v1/MedicationRequest`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(fhirData),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(JSON.stringify(error));
      }

      const result = await response.json();

      console.log("✅ Resep terkirim!");
      console.log("   Medication Request IHS:", result.id);
      console.log("   Obat:", drugNames);

      return {
        success: true,
        medicationIHS: result.id,
      };
    } catch (error) {
      console.error("❌ Gagal kirim resep:", error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Cek koneksi ke SATUSEHAT
   */
  async testConnection() {
    try {
      console.log("🔌 Testing koneksi ke SATUSEHAT...");

      const response = await fetch(`${this.baseURL}/dashboard`);

      if (response.ok) {
        console.log("✅ SATUSEHAT TERHUBUNG!");
        return { connected: true };
      } else {
        console.log("❌ SATUSEHAT tidak terjangkau");
        return { connected: false };
      }
    } catch (error) {
      console.log("❌ SATUSEHAT OFFLINE:", error.message);
      return { connected: false, error: error.message };
    }
  }

  /**
   * Kirim data kunjungan (Encounter)
   */
  async sendEncounter(patientIHS, patientName, poli, complaint) {
    try {
      if (!this.token) await this.getToken();

      console.log("🏥 Mengirim kunjungan ke SATUSEHAT...");
      console.log("   Pasien:", patientName);
      console.log("   Poli:", poli);

      const fhirData = {
        resourceType: "Encounter",
        status: "planned",
        class: {
          system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
          code: "AMB",
          display: "ambulatory",
        },
        subject: {
          reference: `Patient/${patientIHS}`,
          display: patientName,
        },
        period: {
          start: new Date().toISOString(),
        },
        reasonCode: [
          {
            text: complaint || `Kunjungan ${poli || "Poli Umum"}`,
          },
        ],
        serviceProvider: {
          reference: "Organization/ORG-001",
          display: "Klinik Test",
        },
      };

      const response = await fetch(`${this.baseURL}/fhir-r4/v1/Encounter`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fhirData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(JSON.stringify(error));
      }

      const result = await response.json();

      console.log("✅ Kunjungan terkirim!");
      console.log("   Encounter IHS:", result.id);

      return {
        success: true,
        encounterIHS: result.id,
      };
    } catch (error) {
      console.error("❌ Gagal kirim kunjungan:", error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// Export instance tunggal (singleton)
export const satusehatBridge = new SatusehatBridge();
