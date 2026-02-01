import pyttsx3

try:
    print("Initializing pyttsx3...")
    engine = pyttsx3.init()
    
    print("Available drivers:")
    # This might fail on some platforms if not initialized
    # proxy object doesn't have drivers directly exposed always in older versions
    # but let's try just printing properties
    
    print("Testing saving to file...")
    engine.save_to_file("This is a test.", "test_audio.wav")
    engine.runAndWait()
    
    import os
    if os.path.exists("test_audio.wav"):
        print("Success! test_audio.wav created.")
        os.remove("test_audio.wav")
    else:
        print("Failure! test_audio.wav NOT created.")

except Exception as e:
    print(f"Error: {e}")
