import requests
import sys
import json
from datetime import datetime

class ComprehendCATAPITester:
    def __init__(self, base_url="https://comprehend-catalyst.preview.emergentagent.com"):
        self.base_url = base_url
        self.session_token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)
        if self.session_token:
            test_headers['Authorization'] = f'Bearer {self.session_token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                self.failed_tests.append({
                    'name': name,
                    'expected': expected_status,
                    'actual': response.status_code,
                    'response': response.text[:200]
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                'name': name,
                'error': str(e)
            })
            return False, {}

    def create_test_session(self):
        """Create a test user and session in MongoDB"""
        print("\n🔧 Creating test user and session...")
        import subprocess
        
        # Create test user and session via mongosh
        mongosh_script = f'''
use('test_database');
var userId = 'test-user-{int(datetime.now().timestamp())}';
var sessionToken = 'test_session_{int(datetime.now().timestamp())}';
db.users.insertOne({{
  user_id: userId,
  email: 'test.user.{int(datetime.now().timestamp())}@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  assessment_completed: false,
  difficulty_level: 3,
  created_at: new Date()
}});
db.user_sessions.insertOne({{
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});
print('SESSION_TOKEN:' + sessionToken);
print('USER_ID:' + userId);
'''
        
        try:
            result = subprocess.run(['mongosh', '--eval', mongosh_script], 
                                  capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                lines = result.stdout.split('\n')
                for line in lines:
                    if 'SESSION_TOKEN:' in line:
                        self.session_token = line.split('SESSION_TOKEN:')[1].strip()
                    elif 'USER_ID:' in line:
                        self.user_id = line.split('USER_ID:')[1].strip()
                
                if self.session_token and self.user_id:
                    print(f"✅ Test session created - Token: {self.session_token[:20]}...")
                    return True
                else:
                    print("❌ Failed to extract session token or user ID")
                    return False
            else:
                print(f"❌ MongoDB script failed: {result.stderr}")
                return False
                
        except Exception as e:
            print(f"❌ Failed to create test session: {str(e)}")
            return False

    def test_public_endpoints(self):
        """Test public endpoints that don't require authentication"""
        print("\n📋 Testing Public Endpoints...")
        
        # Test root endpoint
        self.run_test("Root API", "GET", "api/", 200)
        
        # Test config endpoints
        self.run_test("Get Genres", "GET", "api/config/genres", 200)
        self.run_test("Get Tones", "GET", "api/config/tones", 200)
        self.run_test("Get Structures", "GET", "api/config/structures", 200)
        self.run_test("Get Difficulties", "GET", "api/config/difficulties", 200)
        self.run_test("Get Word Limits", "GET", "api/config/word-limits", 200)

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n🔐 Testing Auth Endpoints...")
        
        # Test /auth/me with valid session
        if self.session_token:
            success, user_data = self.run_test("Get Current User", "GET", "api/auth/me", 200)
            if success and user_data:
                print(f"   User: {user_data.get('name', 'Unknown')}")
        
        # Test /auth/me without session (should fail)
        temp_token = self.session_token
        self.session_token = None
        self.run_test("Get Current User (No Auth)", "GET", "api/auth/me", 401)
        self.session_token = temp_token

    def test_dashboard_endpoints(self):
        """Test dashboard endpoints"""
        print("\n📊 Testing Dashboard Endpoints...")
        
        if not self.session_token:
            print("❌ Skipping dashboard tests - no session token")
            return
            
        self.run_test("Dashboard Stats", "GET", "api/dashboard/stats", 200)
        self.run_test("Dashboard Settings", "GET", "api/dashboard/settings", 200)

    def test_assessment_endpoints(self):
        """Test assessment endpoints"""
        print("\n📝 Testing Assessment Endpoints...")
        
        if not self.session_token:
            print("❌ Skipping assessment tests - no session token")
            return
        
        # Start assessment
        assessment_data = {
            "strongest_genre": "Philosophy & Abstract Reasoning",
            "intermediate_genre": "Science & Technology", 
            "weakest_genre": "Economics & Business"
        }
        success, response = self.run_test("Start Assessment", "POST", "api/assessment/start", 200, assessment_data)
        
        if success and response.get('assessment_id'):
            assessment_id = response['assessment_id']
            print(f"   Assessment ID: {assessment_id}")
            
            # Test generate round (this will take time due to AI generation)
            print("   ⏳ Generating assessment round (may take 10-30 seconds)...")
            round_data = {"assessment_id": assessment_id, "round_number": 1}
            self.run_test("Generate Assessment Round", "POST", "api/assessment/generate-round", 200, round_data)

    def test_reading_endpoints(self):
        """Test reading endpoints"""
        print("\n📖 Testing Reading Endpoints...")
        
        if not self.session_token:
            print("❌ Skipping reading tests - no session token")
            return
        
        # Generate article (this will take time due to AI generation)
        print("   ⏳ Generating article (may take 10-30 seconds)...")
        article_data = {
            "genre": "Philosophy & Abstract Reasoning",
            "difficulty": 3,
            "word_limit_level": 3,
            "tone": "Analytical",
            "structure": "random"
        }
        success, response = self.run_test("Generate Reading Article", "POST", "api/reading/generate", 200, article_data)
        
        if success and response.get('session_id'):
            session_id = response['session_id']
            print(f"   Session ID: {session_id}")
            
            # Test complete reading
            complete_data = {"session_id": session_id, "reading_time_seconds": 120.5}
            self.run_test("Complete Reading", "POST", "api/reading/complete", 200, complete_data)
            
            # Test submit answers
            answers_data = {
                "session_id": session_id,
                "user_what": "Test answer for what question",
                "user_why": "Test answer for why question", 
                "user_structure": "Test answer for structure question"
            }
            print("   ⏳ Evaluating answers (may take 10-30 seconds)...")
            self.run_test("Submit Reading Answers", "POST", "api/reading/submit-answers", 200, answers_data)
        
        # Test reading history
        self.run_test("Reading History", "GET", "api/reading/history", 200)

    def test_vocabulary_endpoints(self):
        """Test vocabulary endpoints"""
        print("\n📚 Testing Vocabulary Endpoints...")
        
        if not self.session_token:
            print("❌ Skipping vocabulary tests - no session token")
            return
        
        # Test get meanings
        meanings_data = {
            "words": ["philosophy", "abstract", "reasoning"],
            "article_content": "This is a test article about philosophy and abstract reasoning concepts."
        }
        print("   ⏳ Getting word meanings (may take 10-30 seconds)...")
        self.run_test("Get Word Meanings", "POST", "api/vocabulary/meanings", 200, meanings_data)
        
        # Test bookmark word
        bookmark_data = {
            "word": "philosophy",
            "meaning": "The study of fundamental questions about existence, knowledge, values, reason, mind, and language",
            "article_sentence": "Philosophy helps us understand abstract concepts.",
            "example_sentence": "She studied philosophy at university.",
            "memory_trick": "Phil-love + Sophia-wisdom = Love of wisdom"
        }
        success, response = self.run_test("Bookmark Word", "POST", "api/vocabulary/bookmark", 200, bookmark_data)
        
        # Test get bookmarks
        self.run_test("Get Bookmarks", "GET", "api/vocabulary/bookmarks", 200)
        
        # Test delete bookmark if we created one
        if success and response.get('vocab_id'):
            vocab_id = response['vocab_id']
            self.run_test("Delete Bookmark", "DELETE", f"api/vocabulary/bookmark/{vocab_id}", 200)

    def cleanup_test_data(self):
        """Clean up test data from database"""
        if not self.user_id:
            return
            
        print(f"\n🧹 Cleaning up test data for user: {self.user_id}")
        import subprocess
        
        cleanup_script = f'''
use('test_database');
db.users.deleteOne({{user_id: '{self.user_id}'}});
db.user_sessions.deleteOne({{user_id: '{self.user_id}'}});
db.assessments.deleteMany({{user_id: '{self.user_id}'}});
db.reading_sessions.deleteMany({{user_id: '{self.user_id}'}});
db.vocabulary.deleteMany({{user_id: '{self.user_id}'}});
db.user_settings.deleteMany({{user_id: '{self.user_id}'}});
print('Cleanup completed');
'''
        
        try:
            subprocess.run(['mongosh', '--eval', cleanup_script], 
                          capture_output=True, text=True, timeout=10)
            print("✅ Test data cleaned up")
        except Exception as e:
            print(f"⚠️  Cleanup failed: {str(e)}")

def main():
    print("🚀 Starting ComprehendCAT API Tests")
    print("=" * 50)
    
    tester = ComprehendCATAPITester()
    
    try:
        # Test public endpoints first
        tester.test_public_endpoints()
        
        # Create test session for authenticated endpoints
        if tester.create_test_session():
            # Test authenticated endpoints
            tester.test_auth_endpoints()
            tester.test_dashboard_endpoints()
            tester.test_assessment_endpoints()
            tester.test_reading_endpoints()
            tester.test_vocabulary_endpoints()
        else:
            print("❌ Could not create test session, skipping authenticated tests")
        
        # Print final results
        print("\n" + "=" * 50)
        print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
        
        if tester.failed_tests:
            print(f"\n❌ Failed Tests ({len(tester.failed_tests)}):")
            for i, test in enumerate(tester.failed_tests, 1):
                print(f"   {i}. {test['name']}")
                if 'error' in test:
                    print(f"      Error: {test['error']}")
                else:
                    print(f"      Expected: {test['expected']}, Got: {test['actual']}")
        
        return 0 if tester.tests_passed == tester.tests_run else 1
        
    finally:
        # Always cleanup test data
        tester.cleanup_test_data()

if __name__ == "__main__":
    sys.exit(main())